// Geckodriver installer for Windows
// Downloads the latest geckodriver release from GitHub and extracts it locally.

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GITHUB_API = 'https://api.github.com/repos/mozilla/geckodriver/releases/latest';
const DOWNLOAD_DIR = __dirname;
const GECKODRIVER_NAME = 'geckodriver.exe';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'browser-control-mcp-firefox',
        'Accept': 'application/vnd.github.v3+json',
      },
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Follow redirect
        https.get(res.headers.location, {
          headers: { 'User-Agent': 'browser-control-mcp-firefox' },
        }, (res2) => {
          let data = '';
          res2.on('data', chunk => { data += chunk; });
          res2.on('end', () => resolve(data));
        }).on('error', reject);
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse response: ' + data.substring(0, 200)));
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, {
      headers: { 'User-Agent': 'browser-control-mcp-firefox' },
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  console.log('Fetching latest geckodriver release info...');
  const release = JSON.parse(await fetchJson(GITHUB_API));
  const version = release.tag_name;
  console.log('Latest version: ' + version);
  
  // Find Windows 64-bit asset
  const asset = release.assets.find(a => 
    a.name.includes('win64') && a.name.endsWith('.zip')
  ) || release.assets.find(a => 
    a.name.includes('win') && a.name.endsWith('.zip')
  );
  
  if (!asset) {
    console.error('No Windows asset found in release. Available assets:');
    release.assets.forEach(a => console.error('  - ' + a.name));
    process.exit(1);
  }
  
  console.log('Downloading: ' + asset.name);
  const zipPath = path.join(DOWNLOAD_DIR, asset.name);
  await downloadFile(asset.browser_download_url, zipPath);
  console.log('Downloaded to: ' + zipPath);
  
  // Extract using PowerShell (Expand-Archive)
  console.log('Extracting...');
  const extractScript = `
    $zip = '${zipPath.replace(/\\/g, '\\\\')}'
    $dest = '${DOWNLOAD_DIR.replace(/\\/g, '\\\\')}'
    Expand-Archive -Path $zip -DestinationPath $dest -Force
    Remove-Item $zip -Force
    Write-Output "Extracted to $dest"
  `;
  
  execSync('powershell.exe -Command "' + extractScript.replace(/\n/g, ' ') + '"', { stdio: 'inherit' });
  
  const geckoPath = path.join(DOWNLOAD_DIR, GECKODRIVER_NAME);
  if (fs.existsSync(geckoPath)) {
    console.log('geckodriver installed at: ' + geckoPath);
    // Test it
    try {
      const output = execSync('"' + geckoPath + '" --version', { encoding: 'utf8' });
      console.log(output.trim());
    } catch (e) {
      console.log('geckodriver installed but version check failed (may still work)');
    }
  } else {
    console.error('Extraction may have failed - geckodriver.exe not found at: ' + geckoPath);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
