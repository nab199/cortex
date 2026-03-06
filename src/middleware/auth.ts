import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.cookies.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.clearCookie('token');
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};
