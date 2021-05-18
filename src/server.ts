import cors from 'cors';
import express from 'express';
import { CacheManager } from './cacheManager';

export class Server {
  private app = express();

  constructor(gitHash: string) {
    const started = new Date();
    const cache = new CacheManager();
    this.app.use(cors());
    this.app.use(express.json());

    this.app.get('/', (req, res) => {
      res.redirect('/health');
    });
    this.app.get('/health', (req, res) => {
      const data = {
        gitHash,
        started,
        cache: cache.summary(),
      };
      res.send(data);
    });

    // api
    const apiBaseUrl = 'https://us-central1-fighter-api.cloudfunctions.net/webApi/api/v1';
    this.app.get(/^\/api\/(.+)/, async (req, res) => {
      const path = req.params[0];
      const url = `${apiBaseUrl}/${path}`;
      try {
        const respBody = await cache.get(url);
        res.send(respBody);
      } catch (err) {
        res.status(503).send(err);
      }
    });
  }

  listen(port: number) {
    this.app.listen(port, () => {
      // tslint:disable-next-line:no-console
      console.log(`server started at http://localhost:${port}`);
    });
  }
}
