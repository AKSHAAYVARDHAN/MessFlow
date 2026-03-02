import { QRCodeSVG } from 'qrcode.react';

export default function QRDisplay({ value, size = 160, label }) {
    if (!value) return null;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-white rounded-xl border border-border shadow-sm">
                <QRCodeSVG
                    value={value}
                    size={size}
                    level="M"
                    bgColor="#FFFFFF"
                    fgColor="#0F172A"
                    includeMargin={false}
                />
            </div>
            {label && (
                <p className="text-xs text-text-muted font-medium">{label}</p>
            )}
        </div>
    );
}
