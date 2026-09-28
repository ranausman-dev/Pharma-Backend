export default function adjustBalance(supplier, amount, type, isRevert = false) {
    let { pay = 0, receive = 0 } = supplier;
  
    if (isRevert) {
      type = type === "purchase" ? "sale" : "purchase";
    }
  
    if (type === "purchase") {
      if (receive >= amount) {
        receive -= amount;
      } else {
        const remaining = amount - receive;
        receive = 0;
        pay += remaining;
      }
    } else if (type === "sale") {
      if (pay >= amount) {
        pay -= amount;
      } else {
        const remaining = amount - pay;
        pay = 0;
        receive += remaining;
      }
    } else {
      throw new Error(`Invalid type: ${type}`);
    }
  
    return { pay, receive };
  }
  