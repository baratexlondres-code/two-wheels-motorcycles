

# Fix: Invoice Print (Blank Page) and Email (Plain Text) on Mobile

## Problems Identified

### 1. Print produces a blank page on mobile (iPhone)
The current print approach uses a hidden `iframe` with `contentWindow.print()`. iOS Safari does not reliably support printing from iframes. The iframe is sized 0x0 and iOS simply ignores or fails silently, resulting in a blank page or nothing happening.

### 2. Email only sends plain text
The `handleEmail` function uses `mailto:` links, which only support plain text in the body. The user expects a properly formatted, print-ready invoice to arrive. `mailto:` cannot send HTML emails -- this is a browser limitation. The solution is to open the full invoice HTML in a new tab so the user can share/print it, and optionally build an edge function to send HTML emails.

## Solution

### A. Fix Print for all devices (iPhone, Android, Tablets, Desktop)
Replace the hidden iframe approach with opening a **new browser tab** containing the full invoice HTML. This tab will:
- Render the complete formatted invoice
- Automatically trigger `window.print()` after loading
- Work reliably on iOS Safari, Chrome Android, and all desktop browsers
- Include a "Print" button on the page itself as fallback

### B. Fix Email to send formatted invoice
Two-part approach:
1. **Immediate fix**: Change the Email button to open the formatted invoice HTML in a new tab (same as print). From there the user can use the browser's native Share feature on mobile to send via email, or print to PDF.
2. **WhatsApp**: Keep the plain text approach (WhatsApp doesn't support HTML), but ensure the link works correctly on mobile.

### C. Preview section contrast fix
The invoice preview inside the modal uses hardcoded light-theme colors (e.g. `#666`, `#f8f8f8`) that clash with the app's dark theme. Wrap the preview in a white background container so inline styles render correctly, matching exactly what will be printed.

## Technical Changes

### File: `src/components/InvoiceModal.tsx`

1. **`handlePrint` function** -- Replace iframe approach:
   - Use `window.open('')` to create a new tab
   - Write the full invoice HTML into it using `document.write()`
   - Call `window.print()` after content loads
   - Add a visible "Print this page" button as fallback for iOS

2. **`handleEmail` function** -- Send formatted invoice:
   - Open the invoice HTML in a new tab (same as print)
   - Add a mailto link inside the rendered page for convenience
   - Alternatively, the user can use the native mobile Share button

3. **Preview section (lines 344-447)** -- Fix contrast:
   - Wrap the preview `div` in a container with `style={{ background: "#fff", color: "#1a1a1a", borderRadius: 8, padding: 16 }}`
   - This ensures the preview looks exactly like the printed output

4. **`buildInvoiceHTML` function** -- Add mobile-friendly print support:
   - Add a visible "Print" button at the top of the HTML page (hidden in `@media print`)
   - Add `<meta name="viewport">` for proper mobile rendering
   - Add a "Share via Email" link using `mailto:` with the invoice number as subject

### No other files need changes
The camera, customer name navigation, and other mobile fixes from previous iterations are already in place.

