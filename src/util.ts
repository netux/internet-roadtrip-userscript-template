interface GM_fetchResponse {
  status: number;
  response: string;
}

export function GM_fetch(
  details: Parameters<typeof GM.xmlHttpRequest>[0],
): Promise<GM_fetchResponse> {
  return new Promise((resolve, reject) => {
    GM.xmlHttpRequest({
      ...details,
      onload: (response) => resolve(response as GM_fetchResponse),
      onerror: (err) => reject(err),
    });
  });
}
