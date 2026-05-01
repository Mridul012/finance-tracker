const errorMiddleware = (err, req, res, next) => {
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Already exists' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Not found' });
  }

  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { detail: err.message }),
  });
};

module.exports = errorMiddleware;
