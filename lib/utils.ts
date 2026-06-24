import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCookies(num: number): string {
  if (num === 0) return "0";
  if (num < 1000) return num.toFixed(1);
  
  const suffixes = [
    { value: 1e3, symbol: " thousand" },
    { value: 1e6, symbol: " million" },
    { value: 1e9, symbol: " billion" },
    { value: 1e12, symbol: " trillion" },
    { value: 1e15, symbol: " quadrillion" },
    { value: 1e18, symbol: " quintillion" }
  ];
  
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  for (let i = suffixes.length - 1; i >= 0; i--) {
    if (num >= suffixes[i].value) {
      return (num / suffixes[i].value).toFixed(2).replace(rx, "$1") + suffixes[i].symbol;
    }
  }
  return num.toFixed(1);
}

export function formatShort(num: number): string {
  if (num < 1000) return num.toString();
  const suffixes = ["K", "M", "B", "T", "Qa", "Qi"];
  const i = Math.floor(Math.log10(num) / 3) - 1;
  if (i >= suffixes.length) return num.toExponential(2);
  const formatted = (num / Math.pow(10, (i + 1) * 3)).toFixed(1);
  return `${formatted}${suffixes[i]}`;
}
