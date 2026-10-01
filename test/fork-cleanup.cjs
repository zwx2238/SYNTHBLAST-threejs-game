// Fork cleanup regression test for the self-hosted SYNTHBLAST build.
//
//   node test/fork-cleanup.cjs
//
// Zero dependencies. Two layers:
//   1. Static assertions on index.html / js/classes/ui/MenuScreen.js: every
//      advertising surface removed by this fork stays removed, every
//      functional or attribution surface this fork must keep is still present,
//      and no dangling references to deleted nodes remain.
//   2. A syntax check of every inline <script> block in index.html, so a bad
//      HTML edit cannot ship a broken page.
var fs = require('fs');
var path = require('path');
var os = require('os');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');
var index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var menu = fs.readFileSync(path.join(ROOT, 'js', 'classes', 'ui', 'MenuScreen.js'), 'utf8');

var failures = 0;
function check(desc, ok) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + desc);
  if (!ok) failures++;
}
function absent(needle, desc) {
  check(desc + ' removed', index.indexOf(needle) === -1);
}

// --- advertising surfaces removed ------------------------------------------
absent('pagead2.googlesyndication.com', 'AdSense loader host');
absent('adsbygoogle', 'AdSense push/ins scaffolding');
absent('ca-pub-', 'AdSense publisher id');
absent('data-ad-slot', 'AdSense slot id');
absent('data-ad-client', 'AdSense client attribute');
absent('id="banner"', 'empty ad banner container');
absent('#banner', 'ad banner CSS');
absent('Merchandise', 'merchandise pitch in canvas fallback');

// --- functional and attribution surfaces preserved -------------------------
var kept = [
  ['game module entry', 'import * as THREE from "three"'],
  ['game module entry (game)', './js/classes/Game.js'],
  ['player state (local save data)', 'let playerState = {'],
  ['music playback', 'music/taketheworld-outro.mp3'],
  ['canvas screen root', '<canvas id="screen">'],
  ['gameplay description', 'The goal of Synth Blast is to complete as many levels'],
  ['feature description (flip pad)', 'flip pad'],
  ['source attribution button label', 'S0URC3 C0D3'],
  ['source attribution button target', 'https://github.com/brianrisk/SYNTHBLAST'],
  ['similar-games heritage list', 'Games similar to Synth Blast'],
  ['high-score placeholder (upstream parity, never called)', 'function getHighScores()']
];
kept.forEach(function (pair) {
  check(pair[0] + ' kept in index.html or MenuScreen.js',
    index.indexOf(pair[1]) !== -1 || menu.indexOf(pair[1]) !== -1);
});

// The commented-out leader board / equipment / settings stubs are upstream
// gameplay scaffolding, not promotion, and must survive untouched.
check('upstream gameplay stubs untouched', menu.indexOf('LEAD3RB04RD') !== -1);

// --- no dangling references to deleted nodes -------------------------------
['id="banner"', '#banner', 'adsbygoogle'].forEach(function (id) {
  check('no dangling reference to ' + id, index.indexOf(id) === -1);
});

// --- every inline <script> block still parses -------------------------------
var scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
var match, count = 0, syntaxErrors = 0;
var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synthblast-inline-'));
while ((match = scriptRe.exec(index)) !== null) {
  var attrs = match[1];
  var body = match[2];
  if (/type\s*=\s*["'](application\/ld\+json|text\/template)["']/.test(attrs)) continue;
  if (/\ssrc\s*=/.test(attrs)) continue;
  if (!body.trim()) continue;
  count++;
  var file = path.join(tmpDir, 'inline-' + count + '.mjs');
  fs.writeFileSync(file, body);
  var res = cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) {
    syntaxErrors++;
    console.log('FAIL inline script #' + count + ' has a syntax error:');
    console.log((res.stderr || '').split('\n').slice(0, 4).join('\n'));
  }
}
check('all ' + count + ' inline scripts parse cleanly', syntaxErrors === 0);

fs.rmSync(tmpDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(failures + ' check(s) failed');
  process.exit(1);
}
console.log('fork cleanup checks passed');
