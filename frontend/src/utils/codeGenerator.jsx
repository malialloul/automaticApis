/**
 * Generate code snippets for API endpoints in various languages/frameworks
 */

export const generateCodeSnippet = (endpoint, language, options = {}) => {
  const {
    baseUrl = 'http://localhost:3001',
    params = {},
    body = null,
    headers = {},
    pathParams = {},
  } = options;

  // Build URL with path params
  let url = `${baseUrl}${endpoint.path}`;
  Object.entries(pathParams).forEach(([key, value]) => {
    url = url.replace(`:${key}`, value);
  });

  // Add query params
  const queryString = new URLSearchParams(params).toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  const generators = {
    'javascript-fetch': generateJavaScriptFetch,
    'javascript-axios': generateJavaScriptAxios,
    'javascript-jquery': generateJavaScriptJQuery,
    'curl': generateCurl,
    'python-requests':  generatePythonRequests,
    'python-http':  generatePythonHttp,
    'php-curl': generatePhpCurl,
    'php-guzzle': generatePhpGuzzle,
    'java-okhttp': generateJavaOkHttp,
    'csharp-httpclient': generateCSharpHttpClient,
    'go-http': generateGoHttp,
    'ruby-net': generateRubyNet,
    'swift-urlsession': generateSwiftUrlSession,
    'kotlin-okhttp': generateKotlinOkHttp,
  };

  const generator = generators[language];
  if (!generator) {
    throw new Error(`Unsupported language: ${language}`);
  }

  return generator(url, endpoint.method, body, headers);
};

// JavaScript - Fetch API
function generateJavaScriptFetch(url, method, body, headers) {
  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method);
  
  return `// Using Fetch API
fetch('${url}', {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json',
    ${Object.entries(headers).map(([k, v]) => `'${k}': '${v}'`).join(',\n    ')}
  }${hasBody ? `,
  body: JSON.stringify(${JSON.stringify(body, null, 2)})` : ''}
})
  .then(response => {
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Success:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  });`;
}

// JavaScript - Axios
function generateJavaScriptAxios(url, method, body, headers) {
  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method);
  
  return `// Using Axios
import axios from 'axios';

axios({
  method: '${method.toLowerCase()}',
  url: '${url}',
  headers: {
    'Content-Type': 'application/json',
    ${Object.entries(headers).map(([k, v]) => `'${k}': '${v}'`).join(',\n    ')}
  }${hasBody ? `,
  data: ${JSON.stringify(body, null, 2)}` : ''}
})
  .then(response => {
    console.log('Success:', response.data);
  })
  .catch(error => {
    console.error('Error:', error.response?.data || error.message);
  });

// Or using async/await
async function fetchData() {
  try {
    const response = await axios["${method.toLowerCase()}"]('${url}'${hasBody ? `, ${JSON.stringify(body, null, 2)}` : ''});
    console.log('Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}`;
}

// JavaScript - jQuery
function generateJavaScriptJQuery(url, method, body, headers) {
  return `// Using jQuery
$.ajax({
  url: '${url}',
  type: '${method}',
  headers: {
    ${Object.entries(headers).map(([k, v]) => `'${k}': '${v}'`).join(',\n    ')}
  },
  ${body ? `data: JSON.stringify(${JSON.stringify(body, null, 2)}),
  contentType: 'application/json',` : ''}
  success: function(data) {
    console.log('Success:', data);
  },
  error: function(xhr, status, error) {
    console.error('Error:', error);
  }
});`;
}

// cURL
function generateCurl(url, method, body, headers) {
  let cmd = `curl -X ${method} '${url}'`;
  
  // Add headers
  cmd += ` \\\n  -H 'Content-Type: application/json'`;
  Object.entries(headers).forEach(([key, value]) => {
    cmd += ` \\\n  -H '${key}: ${value}'`;
  });
  
  // Add body
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    cmd += ` \\
  -d '${JSON.stringify(body)}'`;
  }
  return cmd;
}

// Python - Requests
function generatePythonRequests(url, method, body, headers) {
  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method);
  
  return `# Using requests library
import requests
import json

url = '${url}'
headers = {
  'Content-Type': 'application/json',
  ${Object.entries(headers).map(([k, v]) => `'${k}': '${v}'`).join(',\n    ')}
}
${hasBody ? `
data = ${JSON.stringify(body, null, 2).replace(/"/g, "'")}
` : ''}
try:
    response = requests.${method.toLowerCase()}(url, headers=headers${hasBody ? ', json=data' : ''})
    response.raise_for_status()
    
    result = response.json()
    print('Success:', result)
except requests.exceptions.RequestException as e:
    print('Error:', e)`;
}

// Python - HTTP client
function generatePythonHttp(url, method, body, headers) {
  const urlObj = new URL(url);
  
  return `# Using http.client
import http.client
import json

conn = http.client.HTTPConnection('${urlObj.host}')

headers = {
    'Content-Type': 'application/json',
    ${Object.entries(headers).map(([k, v]) => `'${k}': '${v}'`).join(',\n    ')}
}

${body ? `payload = json.dumps(${JSON.stringify(body, null, 2).replace(/"/g, "'")})` : 'payload = ""'}

conn.request('${method}', '${urlObj.pathname}${urlObj.search}', payload, headers)
res = conn.getresponse()
data = res.read()

print(data.decode('utf-8'))`;
}

// PHP - cURL
function generatePhpCurl(url, method, body, headers) {
  return `<?php
// Using cURL

$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => '${url}',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => '${method}',
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        ${Object.entries(headers).map(([k, v]) => `'${k}:  ${v}'`).join(',\n        ')}
    ],
    ${body ? `CURLOPT_POSTFIELDS => json_encode(${JSON.stringify(body, null, 2).replace(/"/g, "'")}),` : ''}
]);

$response = curl_exec($curl);
$err = curl_error($curl);

curl_close($curl);

if ($err) {
    echo 'Error: ' . $err;
} else {
    $data = json_decode($response, true);
    print_r($data);
}
?>`;
}

// PHP - Guzzle
function generatePhpGuzzle(url, method, body, headers) {
  return `<?php
// Using Guzzle HTTP Client

require 'vendor/autoload.php';

use GuzzleHttp\\Client;

$client = new Client();

try {
    $response = $client->request('${method}', '${url}', [
        'headers' => [
            'Content-Type' => 'application/json',
            ${Object.entries(headers).map(([k, v]) => `'${k}' => '${v}'`).join(',\n            ')}
        ],
        ${body ? `'json' => ${JSON.stringify(body, null, 2).replace(/"/g, "'")}` : ''}
    ]);
    
    $data = json_decode($response->getBody(), true);
    print_r($data);
} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage();
}
?>`;
}

// Java - OkHttp
function generateJavaOkHttp(url, method, body, headers) {
  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method);
  
  return `// Using OkHttp
import okhttp3.*;
import java.io.IOException;

public class ApiRequest {
    public static void main(String[] args) throws IOException {
        OkHttpClient client = new OkHttpClient();
        
        ${hasBody ? `MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        String json = "${JSON.stringify(body).replace(/"/g, '\\"')}";
        RequestBody body = RequestBody.create(JSON, json);
        ` : ''}
        Request request = new Request.Builder()
          .url("${url}")
          .method("${method}", ${hasBody ? 'body' : 'null'})
            ${Object.entries(headers).map(([k, v]) => `.addHeader("${k}", "${v}")`).join('\n            ')}
            .addHeader("Content-Type", "application/json")
            .build();
        
        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Unexpected code " + response);
            }
            System.out.println(response.body().string());
        }
    }
}`;
}

// C# - HttpClient
function generateCSharpHttpClient(url, method, body, headers) {
  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method);
  const methodMap = {
    GET: 'GetAsync',
    POST: 'PostAsync',
    PUT: 'PutAsync',
    PATCH: 'PatchAsync',
    DELETE: 'DeleteAsync',
  };
  const httpMethod = methodMap[method] || 'GetAsync';
  
  return `// Using HttpClient
using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        using var client = new HttpClient();
        
        client.DefaultRequestHeaders.Add("Content-Type", "application/json");
        ${Object.entries(headers).map(([k, v]) => `client.DefaultRequestHeaders.Add("${k}", "${v}");`).join('\n        ')}
        
        ${hasBody ? `var content = new StringContent(
            @"${JSON.stringify(body)}",
            Encoding.UTF8,
            "application/json"
        );
        ` : ''}
        try
        {
          var response = await client.${httpMethod}(
                "${url}"${hasBody ? ', content' : ''}
            );
            response.EnsureSuccessStatusCode();
            
            var result = await response.Content.ReadAsStringAsync();
            Console.WriteLine(result);
        }
        catch (HttpRequestException e)
        {
          Console.WriteLine($"Error: {e.Message}");
        }
    }
}`;
}

// Go - net/http
function generateGoHttp(url, method, body, headers) {
  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method);
  
  return `// Using net/http
package main

import (
    "fmt"
    "io/ioutil"
    "net/http"
    ${hasBody ? '"bytes"' : ''}
)

func main() {
    url := "${url}"
    
  ${hasBody ? `jsonData := []byte("${JSON.stringify(body).replace(/"/g, '\\"')}")
  req, err := http.NewRequest("${method}", url, bytes.NewBuffer(jsonData))` : 
    `req, err := http.NewRequest("${method}", url, nil)`}
    
    if err != nil {
      fmt.Println("Error creating request:", err)
        return
    }
    
    req.Header.Set("Content-Type", "application/json")
    ${Object.entries(headers).map(([k, v]) => `req.Header.Set("${k}", "${v}")`).join('\n    ')}
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        fmt.Println("Error making request:", err)
        return
    }
    defer resp.Body.Close()
    
    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        fmt.Println("Error reading response:", err)
        return
    }
    
    fmt.Println(string(body))
}`;
}

// Ruby - Net::HTTP
function generateRubyNet(url, method, body, headers) {
  return `# Using Net::HTTP
require 'net/http'
require 'json'
require 'uri'

uri = URI('${url}')

http = Net::HTTP.new(uri.host, uri.port)
klass = case '${method}'
when 'GET' then Net::HTTP::Get
when 'POST' then Net::HTTP::Post
when 'PUT' then Net::HTTP::Put
when 'PATCH' then Net::HTTP::Patch
when 'DELETE' then Net::HTTP::Delete
else Net::HTTP::Get
end
request = klass.new(uri.path)

request['Content-Type'] = 'application/json'
${Object.entries(headers).map(([k, v]) => `request['${k}'] = '${v}'`).join('\n')}

${body ? `request.body = ${JSON.stringify(body, null, 2).replace(/"/g, "'")}.to_json` : ''}

response = http.request(request)
puts JSON.parse(response.body)`;
}

// Swift - URLSession
function generateSwiftUrlSession(url, method, body, headers) {
  return `// Using URLSession
import Foundation

let url = URL(string: "${url}")! 
var request = URLRequest(url: url)
request.httpMethod = "${method}"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
${Object.entries(headers).map(([k, v]) => `request.setValue("${v}", forHTTPHeaderField: "${k}")`).join('\n')}

${body ? `let jsonData = try! JSONSerialization.data(withJSONObject: ${JSON.stringify(body, null, 2)})
request.httpBody = jsonData
` : ''}
let task = URLSession.shared.dataTask(with: request) { data, response, error in
    guard let data = data, error == nil else {
        print("Error:", error?.localizedDescription ?? "Unknown error")
        return
    }
    
    if let json = try? JSONSerialization.jsonObject(with: data) {
        print("Success:", json)
    }
}

task.resume()`;
}

// Kotlin - OkHttp
function generateKotlinOkHttp(url, method, body, headers) {
  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method);
  
  return `// Using OkHttp
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

fun main() {
  val client = OkHttpClient()
    
  ${hasBody ? `val json = """${JSON.stringify(body)}"""
  val body = json.toRequestBody("application/json".toMediaType())
  ` : ''}
  val request = Request.Builder()
    .url("${url}")
    .method("${method}", ${hasBody ? 'body' : 'null'})
    ${Object.entries(headers).map(([k, v]) => `.addHeader("${k}", "${v}")`).join('\n        ')}
    .addHeader("Content-Type", "application/json")
    .build()
    
  client.newCall(request).execute().use { response ->
    if (!response.isSuccessful) {
      throw Exception("Unexpected code $response")
    }
    println(response.body?.string())
  }
}`;
}

export const LANGUAGE_OPTIONS = [
  { value: 'javascript-fetch', label: 'JavaScript (Fetch)', icon: '🟨' },
  { value: 'javascript-axios', label: 'JavaScript (Axios)', icon: '🟨' },
  { value: 'javascript-jquery', label: 'JavaScript (jQuery)', icon: '🟨' },
  { value: 'curl', label: 'cURL', icon: '💻' },
  { value:  'python-requests', label:  'Python (Requests)', icon: '🐍' },
  { value:  'python-http', label: 'Python (http.client)', icon: '🐍' },
  { value:  'php-curl', label:  'PHP (cURL)', icon: '🐘' },
  { value: 'php-guzzle', label: 'PHP (Guzzle)', icon: '🐘' },
  { value: 'java-okhttp', label: 'Java (OkHttp)', icon: '☕' },
  { value: 'csharp-httpclient', label: 'C# (HttpClient)', icon: '🔷' },
  { value: 'go-http', label: 'Go (net/http)', icon: '🔵' },
  { value: 'ruby-net', label: 'Ruby (Net:: HTTP)', icon: '💎' },
  { value: 'swift-urlsession', label: 'Swift (URLSession)', icon: '🍎' },
  { value:  'kotlin-okhttp', label: 'Kotlin (OkHttp)', icon: '🟣' },
];

/**
 * Backend implementation code generators
 * Generate ready-to-copy server-side CRUD handlers for each table
 */

const pickIdColumn = (tableSchema) => {
  const pk = (tableSchema?.primaryKeys && tableSchema.primaryKeys[0]) || 'id';
  return pk;
};

const sanitizeIdent = (name) => String(name || '').replace(/[^A-Za-z0-9_]/g, '_');

// Node.js (Express + pg)
const backendExpressPg = (tableName, tableSchema) => {
  const idCol = pickIdColumn(tableSchema);
  const safeTable = sanitizeIdent(tableName);
  const relationSections = [];
  for (const fk of (tableSchema.foreignKeys || [])) {
    const related = sanitizeIdent(fk.foreignTable);
    relationSections.push(
`// Belongs-to relation: ${safeTable} -> ${related}
router.get(basePath + '/:id/${related}', async (req, res) => {
  try {
    const { limit = 100, offset = 0, orderBy, orderDir } = req.query;
    const sub = "SELECT \"${fk.columnName}\" FROM \"${safeTable}\" WHERE \"${idCol}\" = $1";
    let sql = "SELECT * FROM \"${related}\" WHERE \"${fk.foreignColumn}\" = (" + sub + ")";
    if (orderBy) {
      const dir = String(orderDir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      sql += " ORDER BY \"" + orderBy + "\" " + dir;
    }
    sql += " LIMIT $2 OFFSET $3";
    const { rows } = await pool.query(sql, [req.params.id, Number(limit), Number(offset)]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`);
  }
  for (const rfk of (tableSchema.reverseForeignKeys || [])) {
    const related = sanitizeIdent(rfk.referencingTable);
    relationSections.push(
`// Has-many relation: ${safeTable} <- ${related}
router.get(basePath + '/:id/${related}', async (req, res) => {
  try {
    const { limit = 100, offset = 0, orderBy, orderDir } = req.query;
    let sql = "SELECT * FROM \"${related}\" WHERE \"${rfk.referencingColumn}\" = $1";
    if (orderBy) {
      const dir = String(orderDir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      sql += " ORDER BY \"" + orderBy + "\" " + dir;
    }
    sql += " LIMIT $2 OFFSET $3";
    const { rows } = await pool.query(sql, [req.params.id, Number(limit), Number(offset)]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`);
  }
  return `// routes/${safeTable}.js
const express = require('express');
const { Pool } = require('pg');

// Configure your database connection
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
});

const router = express.Router();
const basePath = '/${safeTable}';

router.get(basePath, async (req, res) => {
  try {
    const { limit = 100, offset = 0, orderBy, orderDir, ...filters } = req.query;
    const where = [];
    const values = [];
    Object.entries(filters).forEach(([k, v], i) => {
      where.push("\"" + safeTable + "\".\"" + k + "\" = $" + (i + 1));
      values.push(v);
    });
    let sql = "SELECT * FROM \"" + safeTable + "\"" + (where.length ? " WHERE " + where.join(' AND ') : '');
    if (orderBy) {
      const dir = String(orderDir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      sql += " ORDER BY \"" + orderBy + "\" " + dir;
    }
    sql += " LIMIT $" + (values.length + 1) + " OFFSET $" + (values.length + 2);
    values.push(Number(limit), Number(offset));
    const { rows } = await pool.query(sql, values);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get(basePath + '/:id', async (req, res) => {
  try {
    const sql = "SELECT * FROM \"" + safeTable + "\" WHERE \"" + idCol + "\" = $1";
    const { rows } = await pool.query(sql, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Relationship endpoints
${relationSections.join('\n')}

router.post(basePath, async (req, res) => {
  try {
    const body = req.body || {};
    const keys = Object.keys(body);
    if (!keys.length) return res.status(400).json({ error: 'No fields provided' });
    const cols = keys.map(k => "\"" + k + "\"").join(', ');
    const placeholders = keys.map((_, i) => "$" + (i + 1)).join(', ');
    const values = keys.map(k => body[k]);
    const sql = "INSERT INTO \"" + safeTable + "\" (" + cols + ") VALUES (" + placeholders + ") RETURNING *";
    const { rows } = await pool.query(sql, values);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put(basePath + '/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const keys = Object.keys(body);
    if (!keys.length) return res.status(400).json({ error: 'No fields provided' });
    const sets = keys.map((k, i) => "\"" + k + "\" = $" + (i + 1)).join(', ');
    const values = keys.map(k => body[k]);
    values.push(req.params.id);
    const sql = "UPDATE \"" + safeTable + "\" SET " + sets + " WHERE \"" + idCol + "\" = $" + (keys.length + 1) + " RETURNING *";
    const { rows } = await pool.query(sql, values);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete(basePath + '/:id', async (req, res) => {
  try {
    const sql = "DELETE FROM \"" + safeTable + "\" WHERE \"" + idCol + "\" = $1 RETURNING *";
    const { rows } = await pool.query(sql, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`;
};

// Python (FastAPI + asyncpg)
const backendFastAPI = (tableName, tableSchema) => {
  const idCol = pickIdColumn(tableSchema);
  const safeTable = sanitizeIdent(tableName);
  const relationSections = [];
  for (const fk of (tableSchema.foreignKeys || [])) {
    const related = sanitizeIdent(fk.foreignTable);
    relationSections.push(
`# Belongs-to relation: ${safeTable} -> ${related}
@router.get(f"{base_path}/{{id}}/${related}")
async def ${safeTable}_to_${related}(id: str, limit: int = 100, offset: int = 0, orderBy: str | None = None, orderDir: str | None = None):
    pool = await get_pool()
    sql = 'SELECT * FROM "${related}" WHERE "${fk.foreignColumn}" = (SELECT "${fk.columnName}" FROM "${safeTable}" WHERE "${idCol}" = $1)'
    if orderBy:
        dir = 'DESC' if str(orderDir or 'ASC').upper() == 'DESC' else 'ASC'
        sql += ' ORDER BY "' + orderBy + '" ' + dir
    sql += ' LIMIT $2 OFFSET $3'
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, id, limit, offset)
    return [dict(r) for r in rows]
`);
  }
  for (const rfk of (tableSchema.reverseForeignKeys || [])) {
    const related = sanitizeIdent(rfk.referencingTable);
    relationSections.push(
`# Has-many relation: ${safeTable} <- ${related}
@router.get(f"{base_path}/{{id}}/${related}")
async def ${safeTable}_has_${related}(id: str, limit: int = 100, offset: int = 0, orderBy: str | None = None, orderDir: str | None = None):
    pool = await get_pool()
    sql = 'SELECT * FROM "${related}" WHERE "${rfk.referencingColumn}" = $1'
    if orderBy:
        dir = 'DESC' if str(orderDir or 'ASC').upper() == 'DESC' else 'ASC'
        sql += ' ORDER BY "' + orderBy + '" ' + dir
    sql += ' LIMIT $2 OFFSET $3'
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, id, limit, offset)
    return [dict(r) for r in rows]
`);
  }
  return `# ${safeTable}.py
from fastapi import APIRouter, HTTPException
import asyncpg
import os

router = APIRouter()

async def get_pool():
  return await asyncpg.create_pool(
    host=os.getenv('PGHOST', 'localhost'),
    port=int(os.getenv('PGPORT', '5432')),
    user=os.getenv('PGUSER', 'postgres'),
    password=os.getenv('PGPASSWORD', 'postgres'),
    database=os.getenv('PGDATABASE', 'postgres'),
  )

base_path = '/${safeTable}'

@router.get(base_path)
async def list_${safeTable}(limit: int = 100, offset: int = 0, orderBy: str | None = None, orderDir: str | None = None, **filters):
  pool = await get_pool()
  where = []
  values = []
  i = 1
  for k, v in filters.items():
    where.append('"${safeTable}"."' + str(k) + '" = $' + str(i))
    values.append(v)
    i += 1
  sql = 'SELECT * FROM "${safeTable}"' + (' WHERE ' + ' AND '.join(where) if where else '')
  if orderBy:
    dir = 'DESC' if str(orderDir or 'ASC').upper() == 'DESC' else 'ASC'
    sql += ' ORDER BY "' + orderBy + '" ' + dir
  sql += ' LIMIT ' + str(i) + ' OFFSET ' + str(i + 1)
  values.extend([limit, offset])
  async with pool.acquire() as conn:
    rows = await conn.fetch(sql, *values)
  return [dict(r) for r in rows]

@router.get(f"{base_path}/{{id}}")
async def get_${safeTable}_by_id(id: str):
  pool = await get_pool()
  sql = 'SELECT * FROM "${safeTable}" WHERE "${idCol}" = $1'
  async with pool.acquire() as conn:
    row = await conn.fetchrow(sql, id)
  if not row:
    raise HTTPException(status_code=404, detail='Not found')
  return dict(row)

@router.post(base_path)
async def create_${safeTable}(body: dict):
  if not body:
    raise HTTPException(status_code=400, detail='No fields provided')
  keys = list(body.keys())
  cols = ', '.join(['"' + k + '"' for k in keys])
  placeholders = ', '.join(['$' + str(i + 1) for i in range(len(keys))])
  values = [body[k] for k in keys]
  sql = 'INSERT INTO "${safeTable}" (' + cols + ') VALUES (' + placeholders + ') RETURNING *'
  pool = await get_pool()
  async with pool.acquire() as conn:
    row = await conn.fetchrow(sql, *values)
  return dict(row)

@router.put(f"{base_path}/{{id}}")
async def update_${safeTable}(id: str, body: dict):
  if not body:
    raise HTTPException(status_code=400, detail='No fields provided')
  keys = list(body.keys())
  sets = ', '.join(['"' + k + '" = $' + str(i + 1) for i, k in enumerate(keys)])
  values = [body[k] for k in keys]
  values.append(id)
  sql = 'UPDATE "${safeTable}" SET ' + sets + ' WHERE "${idCol}" = $' + str(len(keys) + 1) + ' RETURNING *'
  pool = await get_pool()
  async with pool.acquire() as conn:
    row = await conn.fetchrow(sql, *values)
  if not row:
    raise HTTPException(status_code=404, detail='Not found')
  return dict(row)

@router.delete(f"{base_path}/{{id}}")
async def delete_${safeTable}(id: str):
  pool = await get_pool()
  sql = 'DELETE FROM "${safeTable}" WHERE "${idCol}" = $1 RETURNING *'
  async with pool.acquire() as conn:
    row = await conn.fetchrow(sql, id)
  if not row:
    raise HTTPException(status_code=404, detail='Not found')
  return { 'deleted': dict(row) }
\n# Relationship endpoints\n${relationSections.join('\n')}
`;
};

// Go (Gin + database/sql + lib/pq)
const backendGoGin = (tableName, tableSchema) => {
  const idCol = pickIdColumn(tableSchema);
  const safeTable = sanitizeIdent(tableName);
  const relationSections = [];
  for (const fk of (tableSchema.foreignKeys || [])) {
    const related = sanitizeIdent(fk.foreignTable);
    relationSections.push(
`  // Belongs-to relation: ${safeTable} -> ${related}
  r.GET(base+"/:id/${related}", func(c *gin.Context) {
    id := c.Param("id")
    limit := c.DefaultQuery("limit", "100")
    offset := c.DefaultQuery("offset", "0")
    orderBy := c.Query("orderBy")
    orderDir := c.DefaultQuery("orderDir", "ASC")
    sub := fmt.Sprintf("SELECT \"${fk.columnName}\" FROM \"${safeTable}\" WHERE \"${idCol}\" = $1")
    sql := fmt.Sprintf("SELECT * FROM \"${related}\" WHERE \"${fk.foreignColumn}\" = (%s)", sub)
    if orderBy != "" {
      dir := "ASC"
      if orderDir == "DESC" { dir = "DESC" }
      sql += fmt.Sprintf(" ORDER BY \"%s\" %s", orderBy, dir)
    }
    sql += " LIMIT $2 OFFSET $3"
    rows, err := db.Query(sql, id, limit, offset)
    if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
    defer rows.Close()
    c.JSON(http.StatusOK, scanRows(rows))
  })
`);
  }
  for (const rfk of (tableSchema.reverseForeignKeys || [])) {
    const related = sanitizeIdent(rfk.referencingTable);
    relationSections.push(
`  // Has-many relation: ${safeTable} <- ${related}
  r.GET(base+"/:id/${related}", func(c *gin.Context) {
    id := c.Param("id")
    limit := c.DefaultQuery("limit", "100")
    offset := c.DefaultQuery("offset", "0")
    orderBy := c.Query("orderBy")
    orderDir := c.DefaultQuery("orderDir", "ASC")
    sql := fmt.Sprintf("SELECT * FROM \"${related}\" WHERE \"${rfk.referencingColumn}\" = $1")
    if orderBy != "" {
      dir := "ASC"
      if orderDir == "DESC" { dir = "DESC" }
      sql += fmt.Sprintf(" ORDER BY \"%s\" %s", orderBy, dir)
    }
    sql += " LIMIT $2 OFFSET $3"
    rows, err := db.Query(sql, id, limit, offset)
    if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
    defer rows.Close()
    c.JSON(http.StatusOK, scanRows(rows))
  })
`);
  }
  return `// ${safeTable}.go
package routes

import (
  "database/sql"
  "fmt"
  "net/http"
  
  "github.com/gin-gonic/gin"
  _ "github.com/lib/pq"
)

func Register${safeTable.charAt(0).toUpperCase() + safeTable.slice(1)}Routes(r *gin.Engine, db *sql.DB) {
  base := "/${safeTable}"

  r.GET(base, func(c *gin.Context) {
    limit := c.DefaultQuery("limit", "100")
    offset := c.DefaultQuery("offset", "0")
    orderBy := c.Query("orderBy")
    orderDir := c.DefaultQuery("orderDir", "ASC")
    clauses := []string{}
    args := []interface{}{}
    i := 1
    for k, v := range c.Request.URL.Query() {
      if k == "limit" || k == "offset" || k == "orderBy" || k == "orderDir" {
        continue
      }
      clauses = append(clauses, fmt.Sprintf("\"${safeTable}\".\"%s\" = $%d", k, i))
      args = append(args, v[0])
      i++
    }
    sql := fmt.Sprintf("SELECT * FROM \"${safeTable}\"")
    if len(clauses) > 0 {
      sql += " WHERE " + fmt.Sprintf("%s", joinWithAnd(clauses))
    }
    if orderBy != "" {
      dir := "ASC"
      if orderDir == "DESC" { dir = "DESC" }
      sql += fmt.Sprintf(" ORDER BY \"%s\" %s", orderBy, dir)
    }
    sql += fmt.Sprintf(" LIMIT $%d OFFSET $%d", i, i+1)
    args = append(args, limit, offset)
    rows, err := db.Query(sql, args...)
    if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
    defer rows.Close()
    c.JSON(http.StatusOK, scanRows(rows))
  })

  r.GET(base+"/:id", func(c *gin.Context) {
    id := c.Param("id")
    sql := fmt.Sprintf("SELECT * FROM \"${safeTable}\" WHERE \"${idCol}\" = $1")
    row := db.QueryRow(sql, id)
    obj, err := scanRow(row)
    if err == sql.ErrNoRows { c.JSON(http.StatusNotFound, gin.H{"error":"Not found"}); return }
    if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
    c.JSON(http.StatusOK, obj)
  })

  r.POST(base, func(c *gin.Context) {
    var body map[string]interface{}
    if err := c.BindJSON(&body); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
    keys := make([]string, 0, len(body))
    vals := make([]interface{}, 0, len(body))
    placeholders := make([]string, 0, len(body))
    i := 1
    for k, v := range body {
      keys = append(keys, fmt.Sprintf("\"%s\"", k))
      vals = append(vals, v)
      placeholders = append(placeholders, fmt.Sprintf("$%d", i))
      i++
    }
    sql := fmt.Sprintf("INSERT INTO \"${safeTable}\" (%s) VALUES (%s) RETURNING *", joinWithComma(keys), joinWithComma(placeholders))
    row := db.QueryRow(sql, vals...)
    obj, err := scanRow(row)
    if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
    c.JSON(http.StatusCreated, obj)
  })

  r.PUT(base+"/:id", func(c *gin.Context) {
    id := c.Param("id")
    var body map[string]interface{}
    if err := c.BindJSON(&body); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
    sets := []string{}
    vals := []interface{}{}
    i := 1
    for k, v := range body {
      sets = append(sets, fmt.Sprintf("\"%s\" = $%d", k, i))
      vals = append(vals, v)
      i++
    }
    sql := fmt.Sprintf("UPDATE \"${safeTable}\" SET %s WHERE \"${idCol}\" = $%d RETURNING *", joinWithComma(sets), i)
    vals = append(vals, id)
    row := db.QueryRow(sql, vals...)
    obj, err := scanRow(row)
    if err == sql.ErrNoRows { c.JSON(http.StatusNotFound, gin.H{"error":"Not found"}); return }
    if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
    c.JSON(http.StatusOK, obj)
  })

  r.DELETE(base+"/:id", func(c *gin.Context) {
    id := c.Param("id")
    sql := fmt.Sprintf("DELETE FROM \"${safeTable}\" WHERE \"${idCol}\" = $1 RETURNING *")
    row := db.QueryRow(sql, id)
    obj, err := scanRow(row)
    if err == sql.ErrNoRows { c.JSON(http.StatusNotFound, gin.H{"error":"Not found"}); return }
    if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
    c.JSON(http.StatusOK, gin.H{"deleted": obj})
  })
}

func joinWithComma(arr []string) string {
  if len(arr) == 0 { return "" }
  s := arr[0]
  for i := 1; i < len(arr); i++ { s += ", " + arr[i] }
  return s
}

func joinWithAnd(arr []string) string {
  if len(arr) == 0 { return "" }
  s := arr[0]
  for i := 1; i < len(arr); i++ { s += " AND " + arr[i] }
  return s
}

func scanRows(rows *sql.Rows) []map[string]interface{} {
  cols, _ := rows.Columns()
  res := []map[string]interface{}{}
  for rows.Next() {
    vals := make([]interface{}, len(cols))
    ptrs := make([]interface{}, len(cols))
    for i := range vals { ptrs[i] = &vals[i] }
    _ = rows.Scan(ptrs...)
    m := map[string]interface{}{}
    for i, c := range cols { m[c] = vals[i] }
    res = append(res, m)
  }
  return res
}

func scanRow(row *sql.Row) (map[string]interface{}, error) {
  // TODO: Implement based on your schema (or use struct mapping)
  return map[string]interface{}{}, nil
}
\n// Relationship endpoints
// Registered inside Register${safeTable.charAt(0).toUpperCase() + safeTable.slice(1)}Routes
${relationSections.join('\n')}
`;
};

// Java (Spring Boot + JdbcTemplate)
const backendSpringBoot = (tableName, tableSchema) => {
  const idCol = pickIdColumn(tableSchema);
  const safeTable = sanitizeIdent(tableName);
  const className = safeTable.charAt(0).toUpperCase() + safeTable.slice(1) + 'Controller';
  const relationSections = [];
  for (const fk of (tableSchema.foreignKeys || [])) {
    const related = sanitizeIdent(fk.foreignTable);
    relationSections.push(
`  // Belongs-to relation: ${safeTable} -> ${related}
  @GetMapping("/{id}/${related}")
  public List<Map<String, Object>> ${safeTable}_to_${related}(@PathVariable("id") String id, @RequestParam Map<String, String> params) {
    String limit = params.getOrDefault("limit", "100");
    String offset = params.getOrDefault("offset", "0");
    String orderBy = params.get("orderBy");
    String orderDir = params.getOrDefault("orderDir", "ASC");
    MapSqlParameterSource src = new MapSqlParameterSource();
    src.addValue("id", id);
    src.addValue("limit", Integer.parseInt(limit));
    src.addValue("offset", Integer.parseInt(offset));
    String sql = "SELECT * FROM \"${related}\" WHERE \"${fk.foreignColumn}\" = (SELECT \"${fk.columnName}\" FROM \"${safeTable}\" WHERE \"${idCol}\" = :id)";
    if (orderBy != null && !orderBy.isEmpty()) {
      String dir = "DESC".equalsIgnoreCase(orderDir) ? "DESC" : "ASC";
      sql += " ORDER BY \"" + orderBy + "\" " + dir;
    }
    sql += " LIMIT :limit OFFSET :offset";
    return jdbc.queryForList(sql, src);
  }
`);
  }
  for (const rfk of (tableSchema.reverseForeignKeys || [])) {
    const related = sanitizeIdent(rfk.referencingTable);
    relationSections.push(
`  // Has-many relation: ${safeTable} <- ${related}
  @GetMapping("/{id}/${related}")
  public List<Map<String, Object>> ${safeTable}_has_${related}(@PathVariable("id") String id, @RequestParam Map<String, String> params) {
    String limit = params.getOrDefault("limit", "100");
    String offset = params.getOrDefault("offset", "0");
    String orderBy = params.get("orderBy");
    String orderDir = params.getOrDefault("orderDir", "ASC");
    MapSqlParameterSource src = new MapSqlParameterSource();
    src.addValue("id", id);
    src.addValue("limit", Integer.parseInt(limit));
    src.addValue("offset", Integer.parseInt(offset));
    String sql = "SELECT * FROM \"${related}\" WHERE \"${rfk.referencingColumn}\" = :id";
    if (orderBy != null && !orderBy.isEmpty()) {
      String dir = "DESC".equalsIgnoreCase(orderDir) ? "DESC" : "ASC";
      sql += " ORDER BY \"" + orderBy + "\" " + dir;
    }
    sql += " LIMIT :limit OFFSET :offset";
    return jdbc.queryForList(sql, src);
  }
`);
  }
  return `// ${className}.java
package com.example.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/${safeTable}")
public class ${className} {
  @Autowired
  private NamedParameterJdbcTemplate jdbc;

  @GetMapping
  public List<Map<String, Object>> list(@RequestParam Map<String, String> params) {
    String limit = params.getOrDefault("limit", "100");
    String offset = params.getOrDefault("offset", "0");
    String orderBy = params.get("orderBy");
    String orderDir = params.getOrDefault("orderDir", "ASC");
    MapSqlParameterSource src = new MapSqlParameterSource();
    List<String> where = new ArrayList<>();
    int i = 1;
    for (Map.Entry<String, String> e : params.entrySet()) {
      String k = e.getKey();
      if (Arrays.asList("limit","offset","orderBy","orderDir").contains(k)) continue;
      where.add("\"${safeTable}\".\"" + k + "\" = :p" + i);
      src.addValue("p" + i, e.getValue());
      i++;
    }
    String sql = "SELECT * FROM \"${safeTable}\"" + (where.size() > 0 ? " WHERE " + String.join(" AND ", where) : "");
    if (orderBy != null && !orderBy.isEmpty()) {
      String dir = "DESC".equalsIgnoreCase(orderDir) ? "DESC" : "ASC";
      sql += " ORDER BY \"" + orderBy + "\" " + dir;
    }
    sql += " LIMIT :limit OFFSET :offset";
    src.addValue("limit", Integer.parseInt(limit));
    src.addValue("offset", Integer.parseInt(offset));
    return jdbc.queryForList(sql, src);
  }

  @GetMapping("/{id}")
  public Map<String, Object> getById(@PathVariable("id") String id) {
    String sql = "SELECT * FROM \"${safeTable}\" WHERE \"${idCol}\" = :id";
    List<Map<String, Object>> rows = jdbc.queryForList(sql, new MapSqlParameterSource("id", id));
    if (rows.isEmpty()) throw new RuntimeException("Not found");
    return rows.get(0);
  }

  @PostMapping
  public Map<String, Object> create(@RequestBody Map<String, Object> body) {
    if (body.isEmpty()) throw new RuntimeException("No fields provided");
    List<String> keys = new ArrayList<>(body.keySet());
    List<String> cols = new ArrayList<>();
    List<String> ph = new ArrayList<>();
    MapSqlParameterSource src = new MapSqlParameterSource();
    for (int i = 0; i < keys.size(); i++) {
      String k = keys.get(i);
      cols.add("\"" + k + "\"");
      ph.add(":p" + (i+1));
      src.addValue("p" + (i+1), body.get(k));
    }
    String sql = "INSERT INTO \"${safeTable}\" (" + String.join(", ", cols) + ") VALUES (" + String.join(", ", ph) + ") RETURNING *";
    List<Map<String, Object>> rows = jdbc.queryForList(sql, src);
    return rows.get(0);
  }

  @PutMapping("/{id}")
  public Map<String, Object> update(@PathVariable("id") String id, @RequestBody Map<String, Object> body) {
    if (body.isEmpty()) throw new RuntimeException("No fields provided");
    List<String> keys = new ArrayList<>(body.keySet());
    List<String> sets = new ArrayList<>();
    MapSqlParameterSource src = new MapSqlParameterSource();
    for (int i = 0; i < keys.size(); i++) {
      String k = keys.get(i);
      sets.add("\"" + k + "\" = :p" + (i+1));
      src.addValue("p" + (i+1), body.get(k));
    }
    src.addValue("id", id);
    String sql = "UPDATE \"${safeTable}\" SET " + String.join(", ", sets) + " WHERE \"${idCol}\" = :id RETURNING *";
    List<Map<String, Object>> rows = jdbc.queryForList(sql, src);
    if (rows.isEmpty()) throw new RuntimeException("Not found");
    return rows.get(0);
  }

  @DeleteMapping("/{id}")
  public Map<String, Object> delete(@PathVariable("id") String id) {
    String sql = "DELETE FROM \"${safeTable}\" WHERE \"${idCol}\" = :id RETURNING *";
    List<Map<String, Object>> rows = jdbc.queryForList(sql, new MapSqlParameterSource("id", id));
    if (rows.isEmpty()) throw new RuntimeException("Not found");
    Map<String, Object> resp = new HashMap<>();
    resp.put("deleted", rows.get(0));
    return resp;
  }
\n  // Relationship endpoints
${relationSections.join('\n')}
}
`;
};

// C# (.NET Minimal API + Npgsql)
const backendAspNet = (tableName, tableSchema) => {
  const idCol = pickIdColumn(tableSchema);
  const safeTable = sanitizeIdent(tableName);
  const relationSections = [];
  for (const fk of (tableSchema.foreignKeys || [])) {
    const related = sanitizeIdent(fk.foreignTable);
    relationSections.push(
`app.MapGet("/${safeTable}/{id}/${related}", async (string id, HttpRequest req) => {
  await using var conn = new NpgsqlConnection(connString);
  await conn.OpenAsync();
  var q = req.Query;
  var orderBy = q["orderBy"].ToString();
  var orderDir = q["orderDir"].ToString();
  var limit = int.TryParse(q["limit"], out var l) ? l : 100;
  var offset = int.TryParse(q["offset"], out var o) ? o : 0;
  var sql = $"SELECT * FROM \"${related}\" WHERE \"${fk.foreignColumn}\" = (SELECT \"${fk.columnName}\" FROM \"${safeTable}\" WHERE \"${idCol}\" = ${'$'}1)";
  if (!string.IsNullOrEmpty(orderBy)) {
    var dir = string.Equals(orderDir, "DESC", StringComparison.OrdinalIgnoreCase) ? "DESC" : "ASC";
    sql += $" ORDER BY \"{orderBy}\" {dir}";
  }
  sql += $" LIMIT ${'$'}2 OFFSET ${'$'}3";
  await using var cmd = new NpgsqlCommand(sql, conn);
  cmd.Parameters.AddWithValue(1, id);
  cmd.Parameters.AddWithValue(2, limit);
  cmd.Parameters.AddWithValue(3, offset);
  await using var reader = await cmd.ExecuteReaderAsync();
  var rows = new List<Dictionary<string, object>>();
  while (await reader.ReadAsync()) {
    var row = new Dictionary<string, object>();
    for (int c = 0; c < reader.FieldCount; c++) row[reader.GetName(c)] = reader.GetValue(c);
    rows.Add(row);
  }
  return Results.Json(rows);
});
`);
  }
  for (const rfk of (tableSchema.reverseForeignKeys || [])) {
    const related = sanitizeIdent(rfk.referencingTable);
    relationSections.push(
`app.MapGet("/${safeTable}/{id}/${related}", async (string id, HttpRequest req) => {
  await using var conn = new NpgsqlConnection(connString);
  await conn.OpenAsync();
  var q = req.Query;
  var orderBy = q["orderBy"].ToString();
  var orderDir = q["orderDir"].ToString();
  var limit = int.TryParse(q["limit"], out var l) ? l : 100;
  var offset = int.TryParse(q["offset"], out var o) ? o : 0;
  var sql = $"SELECT * FROM \"${related}\" WHERE \"${rfk.referencingColumn}\" = ${'$'}1";
  if (!string.IsNullOrEmpty(orderBy)) {
    var dir = string.Equals(orderDir, "DESC", StringComparison.OrdinalIgnoreCase) ? "DESC" : "ASC";
    sql += $" ORDER BY \"{orderBy}\" {dir}";
  }
  sql += $" LIMIT ${'$'}2 OFFSET ${'$'}3";
  await using var cmd = new NpgsqlCommand(sql, conn);
  cmd.Parameters.AddWithValue(1, id);
  cmd.Parameters.AddWithValue(2, limit);
  cmd.Parameters.AddWithValue(3, offset);
  await using var reader = await cmd.ExecuteReaderAsync();
  var rows = new List<Dictionary<string, object>>();
  while (await reader.ReadAsync()) {
    var row = new Dictionary<string, object>();
    for (int c = 0; c < reader.FieldCount; c++) row[reader.GetName(c)] = reader.GetValue(c);
    rows.Add(row);
  }
  return Results.Json(rows);
});
`);
  }
  return `// Program.cs (excerpt)
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

string connString = Environment.GetEnvironmentVariable("PG_CONN") ?? "Host=localhost;Username=postgres;Password=postgres;Database=postgres";

app.MapGet("/${safeTable}", async (HttpRequest req) => {
  await using var conn = new NpgsqlConnection(connString);
  await conn.OpenAsync();
  var q = req.Query;
  var where = new List<string>();
  var values = new List<object>();
  int i = 1;
  foreach (var kv in q) {
    var k = kv.Key;
    if (k == "limit" || k == "offset" || k == "orderBy" || k == "orderDir") continue;
    where.Add($"\"${safeTable}\".\"{k}\" = ${'$'}{i}");
    values.Add(kv.Value.ToString());
    i++;
  }
  var sql = $"SELECT * FROM \"${safeTable}\"" + (where.Count > 0 ? $" WHERE {string.Join(" AND ", where)}" : "");
  var orderBy = q["orderBy"].ToString();
  var orderDir = q["orderDir"].ToString();
  if (!string.IsNullOrEmpty(orderBy)) {
    var dir = string.Equals(orderDir, "DESC", StringComparison.OrdinalIgnoreCase) ? "DESC" : "ASC";
    sql += $" ORDER BY \"{orderBy}\" {dir}";
  }
  var limit = int.TryParse(q["limit"], out var l) ? l : 100;
  var offset = int.TryParse(q["offset"], out var o) ? o : 0;
  sql += $" LIMIT ${'$'}{i} OFFSET ${'$'}{i+1}";
  values.Add(limit); values.Add(offset);
  await using var cmd = new NpgsqlCommand(sql, conn);
  for (int p = 0; p < values.Count; p++) cmd.Parameters.AddWithValue(p+1, values[p]);
  await using var reader = await cmd.ExecuteReaderAsync();
  var rows = new List<Dictionary<string, object>>();
  while (await reader.ReadAsync()) {
    var row = new Dictionary<string, object>();
    for (int c = 0; c < reader.FieldCount; c++) row[reader.GetName(c)] = reader.GetValue(c);
    rows.Add(row);
  }
  return Results.Json(rows);
});

app.MapGet("/${safeTable}/{id}", async (string id) => {
  await using var conn = new NpgsqlConnection(connString);
  await conn.OpenAsync();
  var sql = $"SELECT * FROM \"${safeTable}\" WHERE \"${idCol}\" = ${'$'}1";
  await using var cmd = new NpgsqlCommand(sql, conn);
  cmd.Parameters.AddWithValue(1, id);
  await using var reader = await cmd.ExecuteReaderAsync();
  if (!reader.Read()) return Results.NotFound(new { error = "Not found" });
  var row = new Dictionary<string, object>();
  for (int c = 0; c < reader.FieldCount; c++) row[reader.GetName(c)] = reader.GetValue(c);
  return Results.Json(row);
});

app.MapPost("/${safeTable}", async (HttpRequest req) => {
  await using var conn = new NpgsqlConnection(connString);
  await conn.OpenAsync();
  var body = await System.Text.Json.JsonSerializer.DeserializeAsync<Dictionary<string, object>>(req.Body) ?? new();
  if (body.Count == 0) return Results.BadRequest(new { error = "No fields provided" });
  var keys = body.Keys.ToArray();
  var cols = string.Join(", ", keys.Select(k => $"\"{k}\""));
  var ph = string.Join(", ", keys.Select((_, i) => $"${'$'}{i+1}"));
  var sql = $"INSERT INTO \"${safeTable}\" ({cols}) VALUES ({ph}) RETURNING *";
  await using var cmd = new NpgsqlCommand(sql, conn);
  for (int i = 0; i < keys.Length; i++) cmd.Parameters.AddWithValue(i+1, body[keys[i]] ?? DBNull.Value);
  await using var reader = await cmd.ExecuteReaderAsync();
  reader.Read();
  var row = new Dictionary<string, object>();
  for (int c = 0; c < reader.FieldCount; c++) row[reader.GetName(c)] = reader.GetValue(c);
  return Results.Json(row);
});

app.MapPut("/${safeTable}/{id}", async (string id, HttpRequest req) => {
  await using var conn = new NpgsqlConnection(connString);
  await conn.OpenAsync();
  var body = await System.Text.Json.JsonSerializer.DeserializeAsync<Dictionary<string, object>>(req.Body) ?? new();
  if (body.Count == 0) return Results.BadRequest(new { error = "No fields provided" });
  var keys = body.Keys.ToArray();
  var sets = string.Join(", ", keys.Select((k, i) => $"\"{k}\" = ${'$'}{i+1}"));
  var sql = $"UPDATE \"${safeTable}\" SET {sets} WHERE \"${idCol}\" = ${'$'}{keys.Length+1} RETURNING *";
  await using var cmd = new NpgsqlCommand(sql, conn);
  int p = 1;
  foreach (var k in keys) { cmd.Parameters.AddWithValue(p++, body[k] ?? DBNull.Value); }
  cmd.Parameters.AddWithValue(p, id);
  await using var reader = await cmd.ExecuteReaderAsync();
  if (!reader.Read()) return Results.NotFound(new { error = "Not found" });
  var row = new Dictionary<string, object>();
  for (int c = 0; c < reader.FieldCount; c++) row[reader.GetName(c)] = reader.GetValue(c);
  return Results.Json(row);
});

app.MapDelete("/${safeTable}/{id}", async (string id) => {
  await using var conn = new NpgsqlConnection(connString);
  await conn.OpenAsync();
  var sql = $"DELETE FROM \"${safeTable}\" WHERE \"${idCol}\" = ${'$'}1 RETURNING *";
  await using var cmd = new NpgsqlCommand(sql, conn);
  cmd.Parameters.AddWithValue(1, id);
  await using var reader = await cmd.ExecuteReaderAsync();
  if (!reader.Read()) return Results.NotFound(new { error = "Not found" });
  var row = new Dictionary<string, object>();
  for (int c = 0; c < reader.FieldCount; c++) row[reader.GetName(c)] = reader.GetValue(c);
  return Results.Json(new { deleted = row });
});

// Relationship endpoints
${relationSections.join('\n')}

app.Run();
`;
};

export const BACKEND_LANGUAGE_OPTIONS = [
  { value: 'express', label: 'Node.js (Express + pg)' },
  { value: 'fastapi', label: 'Python (FastAPI + asyncpg)' },
  { value: 'go-gin', label: 'Go (Gin + lib/pq)' },
  { value: 'spring', label: 'Java (Spring Boot + JdbcTemplate)' },
  { value: 'aspnet', label: '.NET (Minimal API + Npgsql)' },
];

export const generateBackendSnippet = (schema, tableName, languageKey) => {
  const tableSchema = schema?.[tableName];
  if (!tableSchema) return `// Table '${tableName}' not found in schema`;
  switch (languageKey) {
    case 'express':
      return backendExpressPg(tableName, tableSchema);
    case 'fastapi':
      return backendFastAPI(tableName, tableSchema);
    case 'go-gin':
      return backendGoGin(tableName, tableSchema);
    case 'spring':
      return backendSpringBoot(tableName, tableSchema);
    case 'aspnet':
      return backendAspNet(tableName, tableSchema);
    default:
      return `// Unsupported language: ${languageKey}`;
  }
};

export const generateAllBackendForLanguage = (schema, languageKey) => {
  const out = {};
  for (const tableName of Object.keys(schema || {})) {
    out[tableName] = generateBackendSnippet(schema, tableName, languageKey);
  }
  return out;
};

export const generateAllBackendLanguagesForTable = (schema, tableName) => {
  const out = {};
  for (const lang of BACKEND_LANGUAGE_OPTIONS) {
    out[lang.value] = generateBackendSnippet(schema, tableName, lang.value);
  }
  return out;
};