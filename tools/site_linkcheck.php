<?php
/**
 * site_linkcheck.php - sourovdeb.com link checker (no WordPress bootstrap)
 *
 * Purpose: forensic quality control. Checks internal links, sitemap health,
 * and key sentinel URLs without loading WP, without credentials, bounded to
 * 1 request/second. Uses only the public WP REST API and plain HTTP.
 *
 * Usage:
 *   php tools/site_linkcheck.php                # sentinel mode: homepage, robots, sitemap, key pages
 *   php tools/site_linkcheck.php inventory      # pull the full published inventory from WP REST and check it
 *   php tools/site_linkcheck.php file urls.txt  # check a list of absolute URLs (one per line)
 *
 * Output: CSV to stdout: url,status,verdict
 *   verdict OK = 2xx/3xx final; SOFT404 = 200 but body carries the site 404 signature;
 *   BAD = 4xx/5xx; ERR = request failed.
 * Exit code 0 = no BAD/SOFT404, 1 otherwise.
 *
 * Created 2026-11-07, forensic site audit session. PHP 7.4+ (runs under the site's 8.3).
 */

$SITE      = 'https://sourovdeb.com';
$REST      = $SITE . '/wp-json/wp/v2/';
$SIG404    = 'Page not found';      // site 404 signature, verified 2026-11-07
$RATE      = 1000000;              // microseconds between requests (1 req/s)
$UA        = 'sourov-linkcheck/1.0 (+https://sourovdeb.com)';

main($argv);

function main(array $argv): void {
    global $SITE;
    $mode = $argv[1] ?? 'sentinel';

    if ($mode === 'inventory') {
        $urls = inventory_urls();
    } elseif ($mode === 'file') {
        $urls = array_values(array_filter(array_map('trim', file($argv[2]))));
    } else {
        $urls = [
            $SITE . '/',
            $SITE . '/robots.txt',
            $SITE . '/wp-sitemap.xml',
            $SITE . '/sitemap_index.xml',
            $SITE . '/my-daily-journal/journal-europe-travel/',
            $SITE . '/elt365/',
        ];
    }

    $bad = 0;
    foreach ($urls as $url) {
        [$status, $verdict] = check($url);
        if ($verdict !== 'OK') { $bad++; }
        fputcsv(STDOUT, [$url, $status, $verdict]);
        usleep($GLOBALS['RATE']);
    }
    fprintf(STDERR, "Checked %d URLs, %d problems.\n", count($urls), $bad);
    exit($bad > 0 ? 1 : 0);
}

function check(string $url): array {
    global $SIG404, $UA;
    $body = '';
    $status = 0;

    // HEAD first (cheap); fall back to GET when the server refuses HEAD.
    foreach (['HEAD', 'GET'] as $method) {
        $ctx = stream_context_create(['http' => [
            'method'        => $method,
            'timeout'       => 15,
            'follow_location' => 1,
            'max_redirects' => 5,
            'user_agent'    => $UA,
            'ignore_errors' => true,
        ]]);
        $raw = @file_get_contents($url, false, $ctx);
        $status = (int)($http_response_header[0] ? extract_status($http_response_header) : 0);
        if ($status !== 0 && $status !== 405 && $status !== 403) {
            $body = ($method === 'GET' || $status < 400) ? (string)$raw : '';
            break;
        }
        if ($raw === false && $method === 'GET') { return [0, 'ERR']; }
    }
    if ($status === 0) { return [0, 'ERR']; }

    if ($status >= 400) { return [$status, 'BAD']; }
    if ($status === 200 && $body !== '' && strpos($body, $SIG404) !== false) {
        return [200, 'SOFT404'];
    }
    return [$status, 'OK'];
}

function extract_status(array $headers): int {
    if (preg_match('#HTTP/\S+\s+(\d{3})#', $headers[0] ?? '', $m)) {
        return (int)$m[1];
    }
    return 0;
}

/** Full published inventory via public REST: posts, pages, categories. */
function inventory_urls(): array {
    global $REST, $RATE;
    $urls = [];
    foreach (['posts', 'pages'] as $type) {
        $page = 1;
        while (true) {
            $ctx = stream_context_create(['http' => ['timeout' => 20, 'user_agent' => $GLOBALS['UA']]]);
            $json = @file_get_contents($REST . $type . '?per_page=100&status=publish&_fields=link&page=' . $page, false, $ctx);
            if ($json === false) { break; }
            $items = json_decode($json, true);
            if (!is_array($items) || !$items) { break; }
            foreach ($items as $it) { $urls[] = $it['link']; }
            if (count($items) < 100) { break; }
            $page++;
            usleep($RATE);
        }
    }
    return array_values(array_unique($urls));
}
