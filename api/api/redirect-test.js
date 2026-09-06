export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Only GET requests are allowed."
    });
  }

  const target = req.query?.target;

  if (!target) {
    return res.status(400).json({
      error: "Missing target parameter."
    });
  }

  try {
    const redirectTarget = decodeURIComponent(target);

    return res.redirect(302, redirectTarget);
  } catch {
    return res.status(400).json({
      error: "Invalid redirect target."
    });
  }
}
