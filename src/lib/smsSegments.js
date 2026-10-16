// GSM 03.38 default and extension alphabets. Count UTF-16 units for Unicode SMS,
// including both units of a surrogate pair. This is an estimate, not a quote.
const basic=new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const extension=new Set(Array.from('\f^{}\\[~]|€'));
export function smsSegments(message) {
  let units=0,unicode=false;
  const chars=Array.from(message);
  for(const char of chars){if(basic.has(char))units++;else if(extension.has(char))units+=2;else{unicode=true;break;}}
  if(unicode)units=message.length;
  const single=unicode?70:160,multipart=unicode?67:153;
  let segments=units===0?0:1,used=0;
  if(units>single)for(const char of chars){const cost=unicode?char.length:extension.has(char)?2:1;if(used+cost>multipart){segments++;used=0;}used+=cost;}
  return {encoding:unicode?'Unicode':'GSM-7',units,segments};
}
