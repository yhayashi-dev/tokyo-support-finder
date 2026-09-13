# 生活支援ナビ / Tokyo Support Finder

東京都・目黒区の支援を探す、日英対応の個人運営・非公式ガイドです。受給資格の認定や申請代行はしません。

## 第一版の範囲
掲載10制度。住居確保給付金（家賃補助）とマル障はデータを保持して掲載保留。終了制度は試験用資料のみ。日本語・English切替、すべて任意の6入力ブロック、候補一覧と制度詳細を備えます。通常一覧からunknownを消しません。

静的HTML/CSS/JavaScript（ES modules）とJSONのみ。ビルド不要、実行時ライブラリ依存なし。入力はブラウザメモリだけで扱い、再読込で消えます。ログイン、DB、CookieやlocalStorageによる条件保存、広告、アクセス解析、AI API、入力送信なし。フォームや外部フォントも埋め込みません。

## ローカル起動
このディレクトリで `python3 -m http.server 8765 --bind 127.0.0.1` を実行し、ブラウザで http://127.0.0.1:8765/ を開きます。終了はCtrl+C。JSON読込のためfile://で直接開かないでください。

## 検証
Node.js 22以降で依存インストールなしに `npm test` と `npm run check`、または `node --test tests/*.test.js` と `node scripts/check-site.js`。
- 36の承認済み表示判定ケースはtests/cases.json。保留2件も単体試験します。
- 純粋関数はsrc/logic.js。期日はavailability(program, asOf)で注入可能。
- ブラウザ試験：`node scripts/browser-check.mjs`。PlaywrightとChromium実行環境が別途必要（本体の依存ではありません）。PLAYWRIGHT_MODULE、BROWSER_EXECUTABLE、BASE_URL、OUTPUT_DIRで指定できます。テスト専用ブラウザで行い、利用者のプロファイルは使いません。

## データ更新
data/programs.jsonに12制度。publicationをpublished/heldに分離し、終了参考はdata/ended-reference.json。新制度を勝手に公開へ加えません。
1. 公式本文の該当条件・受付告知・FAQを確認。国籍や在留の非明示を対象と断定しない。
2. 共通数値・event_type別の日付・根拠状態を更新。概要・詳細・英語を同じ版で修正。sourceSheetRowsは工程1の来歴で、現在値を直す場合は来歴も更新履歴として明示。
3. checkedAt / translationCheckedAtは実際の確認日。nextReviewは期間型7日・常設28日を目安。日付だけ更新しない。
4. 全試験・画面・公式リンクを確認。予算終了ならbudgetClosedをtrueにする。期限と対象購入・設置・支払回・証更新・ポイント利用期限を分ける。
5. 複雑な所得・医学・在留細分類は人間確認へ。簡易一致は受給資格合格を意味しません。

K＝確認済み、N＝公式に制限なしと確認、S＝確認範囲で記載なし、U＝未確認、X＝非該当。nullは必ず状態とセットで扱います。S/Uを条件なし・対象・無料・無期限へ変換しません。
日英は同じ制度ID・数値・日付・公式URL・判定を使用。翻訳本文でルール判定しません。各データのassessmentは確認状態、statusは制度受付状態、publicationは掲載可否で、相互に代用しません。

## 公開・訂正窓口
公開先は https://yhayashi-dev.github.io/tokyo-support-finder/ 。静的ファイルをmainのルートから配信します。公開結果は管理報告で確認してください。相対パスでGitHub Pagesのプロジェクト配信に対応します。
公開前に期限・予算と公式URLを再確認し、専用訂正窓口の収集設定・Privacyを整合させてください。Google Formsはsrc/ui-text.jsのcorrectionFormURLに設定しています。3質問、訂正内容のみ必須、ログイン不要、メール自動収集なし（2026-09-13回答画面確認）。個別受給相談は扱いません。
canonical・OGP URL・sitemap・robotsは上記公開URLと一致させてください。条件入力をURLへ入れないでください。

## 保守
期間型5件を毎週、常設型5件を4週で一巡。週30分は目標で実証済み保証ではありません。未確認や翻訳待ちは再確認表示へ下げる。完全自動更新はありません。
AI FUND LABその他既存プロジェクトとは独立しています。
