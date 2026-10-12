import app from '../server.ts';

export default function handler(req: any, res: any) {
  // Normalize incoming request path for Express routing under Vercel Serverless Function rewrites
  if (req.url && !req.url.startsWith('/api')) {
    const original = req.originalUrl || req.url;
    req.url = original.startsWith('/api') ? original : '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
}
