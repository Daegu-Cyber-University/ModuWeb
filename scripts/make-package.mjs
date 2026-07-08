/**
 * @fileoverview 배포용 zip 패키지 생성 스크립트
 * @description dist/(빌드 산출물) + 단일 파일 + 사용자 안내/예제를 한 폴더로 모아
 *              `package-build/moduweb-<version>.zip` 으로 압축한다.
 *              일반 사용자가 압축만 풀면 install-guide.html 을 따라 바로 적용할 수 있다.
 *
 *              사용: npm run package
 *              선행: npm run build (dist/ 최신화) — 스크립트가 dist 존재를 검증한다.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const name = `moduweb-${pkg.version}`;

const outDir = path.join(root, 'package-build');
const stage = path.join(outDir, name);
const zipPath = path.join(outDir, `${name}.zip`);

function fail(msg) { console.error(`[package] 실패: ${msg}`); process.exit(1); }

// 0) 선행 조건: dist 빌드 산출물이 있어야 함
const standalone = path.join(root, 'dist', 'webAccTools.standalone.min.js');
if (!fs.existsSync(standalone)) fail('dist/webAccTools.standalone.min.js 없음 — 먼저 `npm run build` 실행');
if (!fs.existsSync(path.join(root, 'dist', 'webAccTools.js'))) fail('dist/webAccTools.js 없음 — 먼저 `npm run build` 실행');

// 1) 스테이징 폴더 초기화
fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(stage, { recursive: true });

// 2) 파일 구성
//    - 단일 파일(방법 A): 최상위에 그대로 둬서 눈에 잘 띄게
fs.copyFileSync(standalone, path.join(stage, 'webAccTools.standalone.min.js'));
//    - 폴더 방식(방법 B): dist/ 통째로 (assets: css·아이콘·로케일·폰트 포함)
fs.cpSync(path.join(root, 'dist'), path.join(stage, 'dist'), { recursive: true });
//    - 사용자 안내/예제
fs.copyFileSync(path.join(root, 'packaging', 'install-guide.html'), path.join(stage, 'install-guide.html'));
fs.copyFileSync(path.join(root, 'packaging', 'example.html'), path.join(stage, 'example.html'));
fs.copyFileSync(path.join(root, 'packaging', 'README.txt'), path.join(stage, 'README.txt'));
//    - 개발자용 문서
fs.copyFileSync(path.join(root, 'README.md'), path.join(stage, 'README.md'));
if (fs.existsSync(path.join(root, 'LICENSE'))) {
	fs.copyFileSync(path.join(root, 'LICENSE'), path.join(stage, 'LICENSE'));
}

// 3) 압축 (Windows: Compress-Archive / 그 외: zip)
if (process.platform === 'win32') {
	execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
		`Compress-Archive -Path "${stage}" -DestinationPath "${zipPath}" -Force`
	], { stdio: 'inherit' });
} else {
	// zip 은 대상 경로를 기준 상대경로로 넣으므로 outDir 에서 실행
	execFileSync('zip', ['-r', '-q', `${name}.zip`, name], { cwd: outDir, stdio: 'inherit' });
}

if (!fs.existsSync(zipPath)) fail('zip 생성 확인 실패');

// 4) 결과 보고
const sizeMB = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
console.log(`\n[package] 완료: ${path.relative(root, zipPath)}  (${sizeMB} MB)`);
console.log('[package] 압축 내용(최상위):');
for (const f of fs.readdirSync(stage)) {
	const p = path.join(stage, f);
	const tag = fs.statSync(p).isDirectory() ? '[폴더]' : '      ';
	console.log(`   ${tag} ${f}`);
}
console.log('\n[package] 배포 시: 이 zip 하나만 전달하면 됩니다. 받는 사람은 압축을 풀고 install-guide.html 을 열면 끝.');
