# Mixer Tabs

以分頁切換混音機控制網頁的原生 HTML／JavaScript 外層。控制頁滿版顯示，預設只保留一顆半透明浮動按鈕。點開按鈕後，可切換分頁、進入全螢幕，或開啟「設定」新增、修改、移除分頁名稱及 HTTP／HTTPS 網址。選取分頁後會自動收合選單；再次點按鈕或按 Escape 也可收合。

拖曳浮動按鈕可吸附左右邊緣，位置只保存在目前裝置；平板旋轉後會依相對高度重新定位，保持可見。按鈕取得鍵盤焦點後，也可使用左右方向鍵切換邊緣、上下方向鍵調整高度。未輸入協定的區網網址會補上 `http://`。

設定與最後選取的分頁只存在目前瀏覽器的 localStorage，不會同步或上傳。切換分頁會保留已載入的 iframe，重新命名也不會重新載入控制頁；修改網址才會重新連線。

## 本機預覽

從專案根目錄執行：

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory output/playwright
```

開啟 [Mixer Tabs](http://127.0.0.1:4173/embed-check.html)。直接開啟 `output/playwright/embed-check.html` 也能使用分頁，但 `file://` 不提供 PWA 安裝。

## GitHub Pages 部署

推送到 `main` 後，GitHub Actions 會自動把 PWA 所需檔案發佈到 [https://marsnow.github.io/soundcraft-ui-pwa/](https://marsnow.github.io/soundcraft-ui-pwa/)。部署流程只會上傳 HTML、CSS、JavaScript、manifest、service worker，以及 manifest 使用的兩個圖示；測試程式、截圖與 ZIP 不會放進網站。

如需重新設定 repository，前往 **Settings → Pages → Build and deployment**，將 Source 設為 **GitHub Actions**。部署完成後，從 Actions 頁面確認 `Deploy GitHub Pages` 工作成功。

## Android 全螢幕與區網使用

PWA manifest 已指定 `display: fullscreen`。透過 HTTPS 提供下列檔案後，可用 Android Chrome 的選單安裝至主畫面；實際顯示模式仍取決於裝置與瀏覽器。一般網頁需要使用者從浮動選單點擊全螢幕按鈕，不能在頁面載入時強制進入全螢幕。

不需要先製作 APK，也不是只把 HTML 下載到平板。PWA 是透過網站安裝，完整網站需要 HTML、CSS、JavaScript、manifest、service worker 與圖示。`dist/` 中的 `mixer-pwa-web-*.zip` 是靜態網站部署包，用來上傳 HTTPS 主機，不是 Android 安裝檔。

安裝順序：

1. Android 平板先連上網路，用 Chrome 開啟 [Mixer Tabs](https://marsnow.github.io/soundcraft-ui-pwa/)。頁面會進入控制介面。
2. 點 Chrome 右上角「⋮」，選擇「安裝應用程式」或「安裝並建立捷徑」，再依提示安裝。
3. 從平板主畫面開啟 Mixer 圖示；第一次先保持網路連線，讓外層頁面與圖示完成快取。
4. 將平板連到混音機所在 Wi-Fi／區網，在浮動選單的「設定」填入混音機網址。

目前的 `http://127.0.0.1:4173/` 是電腦本機預覽網址；平板上的 `127.0.0.1` 代表平板自己，不能用它連回這台電腦。單純以電腦的 HTTP 區網 IP 提供檔案，也不符合正式 PWA 安裝的 HTTPS 條件。

需要部署的檔案都位於 `output/playwright/`，保留相對目錄即可：

- `embed-check.html`
- `index.html`
- `app.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `icons/soundcraft-ui-192.png`、`icons/soundcraft-ui-512.png`

只需部署這些程式檔案，不需要部署測試程式、截圖或測試紀錄。自訂的名稱與網址保留在裝置瀏覽器中。

圖示使用官方 demo 提供的 Soundcraft Ui 原圖，原始尺寸 152 × 152，已另輸出 192 × 192、512 × 512 放大版本供 manifest 使用。來源資訊保留於 `output/playwright/icons/README.md`。

外層頁面成功載入並啟用 service worker 後，可從快取開啟分頁介面；控制頁與即時資料不會被快取。連線混音機仍需要裝置處於可連線的 Wi-Fi／區網。

實體混音機須另行確認其 iframe 限制、HTTPS／HTTP 混合內容以及本地網路權限。瀏覽器支援的本地網路 iframe 權限已委派給該分頁的來源；這不會繞過使用者授權或目標網站的防嵌入設定。如果瀏覽器詢問本地網路存取，需由使用者允許。

參考：[PWA 安裝條件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)、[Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)、[Chrome 本地網路存取](https://developer.chrome.com/blog/local-network-access/)。

## 測試

使用 Playwright 1.64.1。在具備 `@playwright/test` 的環境，從專案根目錄執行：

```sh
npx playwright test --config output/playwright/playwright.config.cjs tabs.spec.cjs
```

一般介面測試使用攔截的混音機測試回應，不會實際連線區網 IP。測試涵蓋桌面、Android 橫向與直向的設定、新增／移除／切換、iframe 狀態保留、本機保存、錯誤處理、全螢幕、外層離線快取，以及浮動按鈕的收合、跨 iframe 拖曳、觸控、位置保存與旋轉定位。產物預設寫入系統暫存目錄。

需要實際重新驗證官方 demo 時：

```sh
MIXER_LIVE=1 npx playwright test --config output/playwright/playwright.config.cjs embed-check.spec.cjs --project android-landscape-emulation
```

這些是 Chromium 瀏覽器模擬測試，尚不能取代 Android 實機安裝及實體混音機的測試。
