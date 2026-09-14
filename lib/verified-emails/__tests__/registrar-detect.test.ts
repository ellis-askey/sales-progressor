/**
 * @jest-environment node
 */

import { detectRegistrarFromNameservers } from "../registrar-detect";

describe("detectRegistrarFromNameservers", () => {
  it("detects GoDaddy from domaincontrol.com", () => {
    expect(detectRegistrarFromNameservers(["ns01.domaincontrol.com", "ns02.domaincontrol.com"])).toBe("GoDaddy");
  });
  it("detects Cloudflare", () => {
    expect(detectRegistrarFromNameservers(["kate.ns.cloudflare.com", "rob.ns.cloudflare.com"])).toBe("Cloudflare");
  });
  it("detects Namecheap", () => {
    expect(detectRegistrarFromNameservers(["dns1.registrar-servers.com"])).toBe("Namecheap");
  });
  it("detects IONOS across its NS TLDs", () => {
    expect(detectRegistrarFromNameservers(["ns1017.ui-dns.com", "ns1099.ui-dns.de"])).toBe("IONOS");
  });
  it("detects 123-reg", () => {
    expect(detectRegistrarFromNameservers(["ns.123-reg.co.uk", "ns2.123-reg.co.uk"])).toBe("123-reg");
  });
  it("is case-insensitive and tolerates trailing dots", () => {
    expect(detectRegistrarFromNameservers(["NS01.DomainControl.com."])).toBe("GoDaddy");
  });
  it("returns null for an unknown provider", () => {
    expect(detectRegistrarFromNameservers(["ns1.someotherhost.net"])).toBeNull();
    expect(detectRegistrarFromNameservers([])).toBeNull();
  });
});
