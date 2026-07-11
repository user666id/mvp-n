import { useEffect, useState } from 'react'

/** Renders `value` as a QR code PNG data-URL on a white rounded plate
 *  (dark-on-light — the most reliably scannable across all client apps). The
 *  `qrcode` lib is imported dynamically, so it's split out of the main bundle and
 *  only fetched the first time a QR is actually shown. */
export function Qr({ value, size = 256 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(value, {
        width: size * 2,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#1f1e1d', light: '#ffffff' },
      }).then((url) => {
        if (alive) setSrc(url)
      }),
    )
    return () => {
      alive = false
    }
  }, [value, size])

  return (
    <div className="mx-auto w-fit rounded-3xl bg-white p-4">
      {src ? (
        <img src={src} width={size} height={size} alt="QR" />
      ) : (
        <div style={{ width: size, height: size }} />
      )}
    </div>
  )
}
