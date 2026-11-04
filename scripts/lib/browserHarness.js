export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function waitFor(read, description) {
  for (let i = 0; i < 300; i++) {
    const value = await read();
    if (value) return value;
    await pause(50);
  }
  throw new Error(`Timed out: ${description}`);
}

export async function connect(url, onEvent = () => {}) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const errors = [];
  const contexts = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method) onEvent(message);
    if (message.method === "Runtime.executionContextCreated" && message.params.context.auxData?.isDefault) contexts.set(message.params.context.auxData.frameId, message.params.context.id);
    if (message.method === "Runtime.executionContextDestroyed") for (const [frame, context] of contexts) { if (context === message.params.executionContextId) contexts.delete(frame); }
    if (message.method === "Runtime.executionContextsCleared") contexts.clear();
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const callback = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
    else callback.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, { resolve, reject });
    socket.send(JSON.stringify({ id: next, method, params }));
  });
  const evaluate = async (expression, contextId) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, ...(contextId ? { contextId } : {}) });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  return { send, evaluate, errors, contexts, close: () => socket.close() };
}
