// Paiement en ligne via Stripe Checkout (optionnel).
// Activé uniquement si la variable d'environnement STRIPE_SECRET_KEY est définie.
const API = 'https://api.stripe.com/v1';

const enabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

async function call(method, endpoint, params) {
  const res = await fetch(API + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Erreur Stripe (${res.status})`);
  return json;
}

function createCheckout({ amount, title, contributionId, email, successUrl, cancelUrl }) {
  const params = {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': `Participation : ${title}`,
    client_reference_id: contributionId,
    'metadata[contributionId]': contributionId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: 'fr',
  };
  if (email) params.customer_email = email;
  return call('POST', '/checkout/sessions', params);
}

const getCheckout = (id) => call('GET', `/checkout/sessions/${encodeURIComponent(id)}`);

module.exports = { enabled, createCheckout, getCheckout };
