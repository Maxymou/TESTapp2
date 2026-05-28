#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.env.HOST_API_PORT || 4878);
const workdir = path.resolve(process.env.PWA_TEST_LAB_WORKDIR || process.cwd());
const token = process.env.DEV_ALLOWED_TOKEN || '';
const timeoutMs = Number(process.env.HOST_COMMAND_TIMEOUT_MS || 180000);
let lastError = null;

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 16_384) {
        reject(new Error('Payload trop volumineux.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON invalide.'));
      }
    });
  });

const requireHostToken = (req, res) => {
  if (!token || token === 'change-me-host-token') {
    sendJson(res, 503, { error: 'DEV_ALLOWED_TOKEN doit être configuré côté Host API.' });
    return false;
  }
  if (req.headers['x-dev-host-token'] !== token) {
    sendJson(res, 401, { error: 'Token Host API invalide.' });
    return false;
  }
  return true;
};

const runCommand = (command, args, options = {}) =>
  new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, {
      cwd: workdir,
      env: process.env,
      shell: false,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      stderr += `\nTimeout après ${options.timeoutMs || timeoutMs} ms`;
      child.kill('SIGTERM');
    }, options.timeoutMs || timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      lastError = error.message;
      clearTimeout(timer);
      resolve({ stdout, stderr: `${stderr}\n${error.message}`.trim(), exitCode: 1, durationMs: Date.now() - started, date: new Date().toISOString() });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const result = { stdout, stderr, exitCode: code ?? 1, durationMs: Date.now() - started, date: new Date().toISOString() };
      if (result.exitCode !== 0) lastError = stderr || `exitCode ${result.exitCode}`;
      resolve(result);
    });
  });

const readUpdateStatus = async () => {
  try {
    return JSON.parse(await readFile(path.join(workdir, 'runtime/update-status.json'), 'utf8'));
  } catch {
    return null;
  }
};

const router = async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (!requireHostToken(req, res)) return;

    if (req.method === 'GET' && url.pathname === '/status') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'dev-host-api',
        workdir,
        lastError,
        updateStatus: await readUpdateStatus(),
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'POST' && url.pathname === '/update') {
      const body = await readBody(req);
      if (!['normal', 'force-pwa'].includes(body.mode)) {
        return sendJson(res, 400, { error: 'Mode update invalide.' });
      }
      const result = await runCommand('./scripts/update.sh', [body.mode], { timeoutMs: 600000 });
      return sendJson(res, 200, { result });
    }

    if (req.method === 'POST' && url.pathname === '/restart') {
      const result = await runCommand('docker', ['compose', 'up', '-d']);
      return sendJson(res, 200, { result });
    }

    if (req.method === 'GET' && url.pathname === '/docker') {
      const result = await runCommand('docker', ['compose', 'ps']);
      return sendJson(res, 200, { result });
    }

    if (req.method === 'GET' && url.pathname === '/logs') {
      const result = await runCommand('docker', ['compose', 'logs', '--tail=160']);
      return sendJson(res, 200, { result });
    }

    return sendJson(res, 404, { error: 'Route inconnue.' });
  } catch (error) {
    lastError = error.message;
    return sendJson(res, 500, { error: error.message || 'Erreur Host API' });
  }
};

createServer(router).listen(port, () => {
  console.log(`PWA Test Lab Host API listening on ${port} for ${workdir}`);
});
