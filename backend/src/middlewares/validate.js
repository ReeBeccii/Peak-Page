export function validate(requiredFields = []) {
  return (req, res, next) => {
    const missing = requiredFields.filter((f) => req.body?.[f] === undefined || req.body?.[f] === null);

    if (missing.length > 0) {
      return res.status(400).json({
        error: "Pflichtfelder fehlen",
        missing,
      });
    }

    next();
  };
}
