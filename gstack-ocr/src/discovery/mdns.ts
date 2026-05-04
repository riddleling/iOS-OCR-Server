// mDNS 服务发现 (待实现)
// iOS OCR Server 使用的是自定义 HTTP 服务，不是标准的 mDNS
// 如需实现，需要先确定 iOS app 发布的服务名

export async function discoverMdns(): Promise<{ host: string; port: number } | null> {
  // TODO: iOS OCR Server 需要在局域网广播服务
  // 标准 mDNS 服务名可能是 _osc._tcp.local 或类似格式
  // 等待 iOS-OCR-Server 项目支持 mDNS 后启用
  return null;
}
