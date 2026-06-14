/**
 * helpers.ts — shared test utilities for agent script integration tests
 */

import * as fs from 'node:fs'
import * as http from 'node:http'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SCRIPTS_DIR = path.resolve(__dirname, '../script')

export const MAP_HEADERS =
  'messageId,transactionId,type,amount,accountId,categoryId,cardId,accountRef,categoryRef,cardRef,note,timestamp,lastModified'

// ─── Temp dirs ────────────────────────────────────────────────────────────────

/** Simple temp dir for in-process unit tests (utils.test.ts). */
export function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'))
}

export function rmTmpDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
}

/**
 * Create an isolated CWD for subprocess script tests.
 * The scripts use DATA_DIR = './data' (relative to CWD), so running them
 * from this directory makes all file I/O go to `cwd/data/`.
 */
export interface ScriptEnv {
  /** Working directory passed to spawnSync. */
  cwd: string
  /** cwd/data — where CSV files are read/written by the scripts. */
  dataDir: string
}

export function makeScriptEnv(): ScriptEnv {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'))
  const dataDir = path.join(cwd, 'data')
  fs.mkdirSync(dataDir)
  return { cwd, dataDir }
}

// ─── Script runner ────────────────────────────────────────────────────────────

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

export function runScript(
  scriptName: string,
  args: string[] = [],
  env: Record<string, string> = {},
  input?: string,
  cwd?: string,
): RunResult {
  const result = spawnSync(
    'npx',
    ['tsx', path.join(SCRIPTS_DIR, scriptName), ...args],
    {
      env: { ...process.env, ...env },
      cwd,
      encoding: 'utf8',
      timeout: 20_000,
      input,
    },
  )
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  }
}

// ─── Mock HTTP server (kept for future use) ───────────────────────────────────

export type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void

export interface MockServer {
  url: string
  close: () => Promise<void>
  requests: Array<{ method: string; url: string; body: string }>
}

export function createMockServer(routes: Record<string, RouteHandler>): Promise<MockServer> {
  const requests: MockServer['requests'] = []

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      const fullUrl = req.url ?? ''
      requests.push({ method: req.method ?? '', url: fullUrl, body })
      // Match by path only (ignore query string)
      const pathname = fullUrl.split('?')[0] ?? ''
      const handler = routes[pathname]
      if (handler) {
        handler(req, res)
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Not found: ${fullUrl}` }))
      }
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
        requests,
      })
    })
  })
}

// ─── CSV fixture writers ──────────────────────────────────────────────────────

export function writeSampleAccounts(dataDir: string, updatedAt: string): void {
  const content = [
    'updatedAt,id,name,type,balance,priorityScore',
    `${updatedAt},acc1,Cash,Cash,1000000,0.85`,
    `${updatedAt},acc2,MoMo,eWallet,500000,0.62`,
  ].join('\n') + '\n'
  fs.writeFileSync(path.join(dataDir, 'accounts.csv'), content)
}

export function writeSampleCategories(dataDir: string, updatedAt: string): void {
  const content = [
    'updatedAt,id,name,type,parentId,note',
    `${updatedAt},cat1,Food & Drink,Expense,null,"meals, restaurant"`,
    `${updatedAt},cat2,Dining Out,Expense,cat1,`,
    `${updatedAt},cat3,Salary,Income,null,monthly pay`,
  ].join('\n') + '\n'
  fs.writeFileSync(path.join(dataDir, 'categories.csv'), content)
}

export function writeSampleCards(dataDir: string, updatedAt: string): void {
  const content = [
    'updatedAt,id,accountId,name,number',
    `${updatedAt},card1,acc1,Visa Card,415231*****9999`,
  ].join('\n') + '\n'
  fs.writeFileSync(path.join(dataDir, 'cards.csv'), content)
}

export function writeSampleMap(
  dataDir: string,
  rows: Record<string, string>[],
): void {
  const headerKeys = MAP_HEADERS.split(',')
  const lines = rows.map((r) =>
    headerKeys.map((k) => r[k] ?? '').join(','),
  )
  fs.writeFileSync(
    path.join(dataDir, 'msg_tx_map.csv'),
    [MAP_HEADERS, ...lines].join('\n') + '\n',
  )
}
