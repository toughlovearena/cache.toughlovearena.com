import cors from 'cors';
import express from 'express';
import fs from 'fs';
import { CacheManager } from './cacheManager';

interface Version {
  v: number;
  u: number;
}

export class Server {
  private app = express();

  constructor() {
    const cache = new CacheManager();
    const { app } = this;
    app.use(cors());
    app.use(express.json());

    app.get('/health', (req, res) => {
      const versionStr = fs.readFileSync('version.json').toString();
      const version = JSON.parse(versionStr) as Version;
      const data = {
        version: version.v,
        cache: cache.summary(),
      };
      res.send(data);
    });

    // api
    const apiBaseUrl = 'https://us-central1-fighter-api.cloudfunctions.net/webApi/api/v1';
    app.get(/^\/api\/(.+)/, async (req, res) => {
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
