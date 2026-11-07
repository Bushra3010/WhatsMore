// Anti-scam AI (warns, never blocks — risk is shown with uncertainty). Ported from js/devices.js.
export function scamCheck(t?: string): string[] {
  const s = (t || '').toLowerCase(), r: string[] = [];
  if (/\b(otp|one[- ]time password|upi pin|cvv)\b/.test(s) && /\b(share|send|tell|forward|enter)\b/.test(s)) r.push('Asks you to share an OTP / PIN — genuine banks and apps never ask for this');
  if (/(bit\.ly|tinyurl\.com|goo\.gl|rb\.gy|cutt\.ly|is\.gd)\//.test(s) || /https?:\/\/[^\s]*\.(xyz|top|click|tk|buzz|loan)\b/.test(s) || /https?:\/\/\d+\.\d+\.\d+\.\d+/.test(s)) r.push('Contains a shortened or suspicious link');
  if (/\bkyc\b|account (will be )?(blocked|suspended|closed|frozen)|verify your account/.test(s)) r.push('Threatens to block your account or asks for a KYC update');
  if (/(lottery|you have won|you('ve| have) been selected|jackpot|lucky draw|claim (your )?(reward|prize))/.test(s)) r.push('Promises a prize or lottery win');
  if (/(processing fee|registration fee|pay .{0,20}to (claim|receive|unlock))/.test(s)) r.push('Asks for a fee before you receive money');
  if (/(double your money|guaranteed returns?|\d+% (daily|weekly|monthly)|risk[- ]free (profit|returns?))/.test(s)) r.push('Promises unrealistic investment returns');
  if (r.length && /\b(urgent|immediately|today itself|within \d+ (hours?|minutes?)|last chance|right now)\b/.test(s)) r.push('Pressures you to act fast');
  return r;
}
