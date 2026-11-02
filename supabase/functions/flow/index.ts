// Edge Function `flow`: pago de banners con Flow (flow.cl). Ver 0056.
//
// Tres rutas:
//   POST /flow/crear      La app (con la sesión del comerciante) pide pagar
//                         sus banners aprobados: se calcula el precio en la
//                         base, se crea el pago en Flow y se devuelve la URL
//                         de la página de pago.
//   POST /flow/confirmar  Flow avisa que hubo un pago (urlConfirmation). Se
//                         comprueba con Flow y, si está pagado, se activa.
//   POST /flow/retorno    Flow devuelve al comprador (urlReturn): se
//                         comprueba igual y se vuelve a la app.
//
// Secretos (Supabase / Edge Functions / Secrets):
//   FLOW_API_KEY      la "API Key" del panel de Flow
//   FLOW_SECRET_KEY   la "Secret Key" del panel de Flow
//   FLOW_API_URL      opcional: https://sandbox.flow.cl/api para pruebas
//                     (por defecto, la de producción)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
//
// Se despliega SIN verificación de JWT (Flow llama sin sesión); /crear
// comprueba la sesión por su cuenta.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const FLOW_API_URL = (Deno.env.get('FLOW_API_URL') ?? 'https://www.flow.cl/api').replace(/\/$/, '');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VOLVER_A_APP = 'kheep://banner/mis';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function claves() {
  const apiKey = Deno.env.get('FLOW_API_KEY');
  const secretKey = Deno.env.get('FLOW_SECRET_KEY');
  if (!apiKey || !secretKey) throw new Error('Faltan las claves de Flow (FLOW_API_KEY y FLOW_SECRET_KEY).');
  return { apiKey, secretKey };
}

/** Firma de Flow: los parámetros ordenados por nombre, "nombrevalor" pegados, HMAC-SHA256 en hexadecimal. */
async function firmar(params: Record<string, string>, secretKey: string): Promise<string> {
  const texto = Object.keys(params)
    .sort()
    .map((k) => k + params[k])
    .join('');
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const firma = await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(texto));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function flowPost(servicio: string, params: Record<string, string>) {
  const { apiKey, secretKey } = claves();
  const todos = { ...params, apiKey };
  const cuerpo = new URLSearchParams({ ...todos, s: await firmar(todos, secretKey) });
  const r = await fetch(`${FLOW_API_URL}/${servicio}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Flow ${servicio}: ${datos.message ?? r.status}`);
  return datos;
}

async function flowGet(servicio: string, params: Record<string, string>) {
  const { apiKey, secretKey } = claves();
  const todos = { ...params, apiKey };
  const query = new URLSearchParams({ ...todos, s: await firmar(todos, secretKey) });
  const r = await fetch(`${FLOW_API_URL}/${servicio}?${query}`);
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Flow ${servicio}: ${datos.message ?? r.status}`);
  return datos;
}

/** El token que manda Flow (en el formulario o en la URL). */
async function tokenDe(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  if (url.searchParams.get('token')) return url.searchParams.get('token');
  if (req.method !== 'POST') return null;
  const texto = await req.text();
  return new URLSearchParams(texto).get('token');
}

/**
 * Pregunta a Flow cómo está el pago del token y lo deja anotado. Con el pago
 * hecho (y del monto esperado) activa los banners. Devuelve el estado.
 */
async function revisar(token: string): Promise<'pagado' | 'pendiente' | 'rechazado' | 'anulado'> {
  const st = await flowGet('payment/getStatus', { token });
  const { data: pago } = await admin.from('pagos').select('id, monto, estado').eq('id', st.commerceOrder).maybeSingle();
  if (!pago) throw new Error(`Pago desconocido: ${st.commerceOrder}`);
  if (pago.estado === 'pagado') return 'pagado';

  // 1 pendiente, 2 pagado, 3 rechazado, 4 anulado
  if (st.status === 2) {
    if (Number(st.amount) !== pago.monto) throw new Error(`Monto distinto en el pago ${pago.id}`);
    const { error } = await admin.rpc('confirmar_pago_banner', { p_pago: pago.id, p_flow_order: st.flowOrder, p_detalle: st });
    if (error) throw error;
    return 'pagado';
  }
  const estado = st.status === 3 ? 'rechazado' : st.status === 4 ? 'anulado' : 'pendiente';
  if (estado !== 'pendiente') await admin.from('pagos').update({ estado, detalle: st }).eq('id', pago.id);
  return estado;
}

async function crear(req: Request): Promise<Response> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: quien } = await admin.auth.getUser(jwt);
  const usuario = quien?.user;
  if (!usuario) return json({ error: 'Debes iniciar sesión.' }, 401);

  const { banner_ids } = (await req.json().catch(() => ({}))) as { banner_ids?: string[] };
  if (!Array.isArray(banner_ids) || banner_ids.length === 0) return json({ error: 'Falta el banner a pagar.' }, 400);

  const { data: banners, error } = await admin
    .from('banners')
    .select('id, usuario_id, estado, pagado')
    .in('id', banner_ids);
  if (error) throw error;
  if (!banners || banners.length !== banner_ids.length || banners.some((b) => b.usuario_id !== usuario.id)) {
    return json({ error: 'Ese banner no es tuyo.' }, 403);
  }
  if (banners.some((b) => b.estado !== 'aprobado')) return json({ error: 'El banner tiene que estar aprobado para pagarlo.' }, 400);
  const porPagar = banners.filter((b) => !b.pagado).map((b) => b.id);
  if (porPagar.length === 0) return json({ error: 'Ese banner ya está pagado.' }, 400);

  const { data: monto, error: errPrecio } = await admin.rpc('precio_banners', { p_ids: porPagar });
  if (errPrecio) throw errPrecio;
  if (!monto || monto <= 0) return json({ error: 'No se pudo calcular el precio.' }, 400);

  const { data: pago, error: errPago } = await admin
    .from('pagos')
    .insert({ usuario_id: usuario.id, banner_ids: porPagar, monto })
    .select('id')
    .single();
  if (errPago) throw errPago;

  const base = `${SUPABASE_URL}/functions/v1/flow`;
  const flow = await flowPost('payment/create', {
    commerceOrder: pago.id,
    subject: porPagar.length === 1 ? 'Banner en Kheep' : `Banner en Kheep (${porPagar.length} comunas)`,
    currency: 'CLP',
    amount: String(monto),
    email: usuario.email ?? '',
    paymentMethod: '9',
    urlConfirmation: `${base}/confirmar`,
    urlReturn: `${base}/retorno`,
  });
  await admin.from('pagos').update({ flow_token: flow.token, flow_order: flow.flowOrder }).eq('id', pago.id);

  return json({ url: `${flow.url}?token=${flow.token}`, monto });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const ruta = new URL(req.url).pathname.split('/').filter(Boolean).pop();

  try {
    if (ruta === 'crear' && req.method === 'POST') return await crear(req);

    if (ruta === 'confirmar') {
      const token = await tokenDe(req);
      if (!token) return new Response('Falta el token', { status: 400 });
      await revisar(token);
      return new Response('OK');
    }

    if (ruta === 'retorno') {
      const token = await tokenDe(req);
      let estado = 'pendiente';
      if (token) estado = await revisar(token).catch(() => 'pendiente');
      return new Response(null, { status: 303, headers: { Location: `${VOLVER_A_APP}?pago=${estado}` } });
    }

    return new Response('No encontrado', { status: 404 });
  } catch (err) {
    console.error(err);
    if (ruta === 'retorno') {
      return new Response(null, { status: 303, headers: { Location: `${VOLVER_A_APP}?pago=error` } });
    }
    return json({ error: err instanceof Error ? err.message : 'Error' }, 500);
  }
});
