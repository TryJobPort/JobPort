import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/billing/checkout", requireAuth, async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      { price: process.env.STRIPE_PRICE_PRO_MONTHLY, quantity: 1 },
    ],
    success_url: `${process.env.WEB_BASE_URL}/billing/success`,
    cancel_url: `${process.env.WEB_BASE_URL}/upgrade`,
    customer_email: req.user.email,
  });

  res.json({ ok: true, url: session.url });
});

router.post("/billing/activate", requireAuth, async (req, res) => {
  await db
    .prepare(`UPDATE users SET plan = 'pro' WHERE id = ?`)
    .run(req.user.id);

  res.json({ ok: true });
});
