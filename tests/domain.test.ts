import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { catalog } from "../shared/catalog";
import { bodySchema, tryonSchema } from "../shared/validation";
import { demoRecommend, recommend } from "../server/recommend";
import { DemoTryonAdapter, HttpTryonAdapter } from "../server/tryon";
import type { Profile, Avatar } from "../shared/types";
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
const profile: Profile = {
  user_id: "user-a",
  display_name: "測試",
  fit_preference: "微寬鬆",
  personalize: true,
  external_ai_consent: false,
};
test("推薦優先匹配報告外套，且只回傳商品庫中有庫存的真實項目", () => {
  const result = demoRecommend(
    "我想找一件上台報告適合的外套",
    catalog,
    profile,
    null,
  );
  assert.equal(result.mode, "demo");
  assert.equal(result.recommendations[0].product_id, "cloud-blazer");
  for (const item of result.recommendations) {
    assert.ok(catalog.find((p) => p.id === item.product_id));
    assert.match(item.reason, /不保證/);
  }
});
test("推薦遵守預算；低於全商品價格時回傳空集合，不捏造商品", () => {
  for (const request of [
    "預算 1000 元",
    "想找 1000 元以下的上衣",
    "不超過1000",
  ]) {
    const result = demoRecommend(request, catalog, null, null);
    assert.ok(result.recommendations.length > 0);
    assert.ok(
      result.recommendations.every(
        (r) => catalog.find((p) => p.id === r.product_id)!.price <= 1000,
      ),
    );
  }
  assert.equal(
    demoRecommend("預算 100 元", catalog, null, null).recommendations.length,
    0,
  );
});
test("零庫存商品不會被推薦；沒有授權不使用身形數據", () => {
  const out = catalog.map((p) => ({
    ...p,
    sizes: p.sizes.map((s) => ({ ...s, stock: 0 })),
  }));
  assert.deepEqual(
    demoRecommend("推薦穿搭", out, null, null).recommendations,
    [],
  );
  assert.ok(
    demoRecommend("韓系穿搭", catalog, null, null).recommendations.every(
      (r) => !r.reason.includes("你填寫的胸圍"),
    ),
  );
  const avatar = { chest: 92 } as Avatar;
  assert.match(
    demoRecommend("韓系穿搭", catalog, profile, avatar).recommendations[0]
      .reason,
    /92 cm/,
  );
});
test("身形與試穿請求拒絕異常值與非 UUID 識別碼", () => {
  assert.equal(bodySchema.safeParse({ height: 165, weight: 58 }).success, true);
  for (const values of [
    { height: 0, weight: 58 },
    { height: 165, weight: NaN },
    { height: 165, weight: 58, waist: 4 },
  ])
    assert.equal(bodySchema.safeParse(values).success, false);
  assert.equal(
    tryonSchema.safeParse({
      request_id: "x",
      product_id: "cloud-blazer",
      size: "M",
      color: "燕麥灰",
    }).success,
    false,
  );
});
test("Demo Adapter 真的合成本人圖片與商品素材，且產生可讀取 WebP", async () => {
  const photo = await sharp({
    create: { width: 600, height: 900, channels: 3, background: "#b2c7d6" },
  })
    .png()
    .toBuffer();
  const result = await new DemoTryonAdapter().generate({
    photo,
    product: catalog[0],
    size: "M",
    color: "燕麥灰",
    profile,
  });
  const meta = await sharp(result).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 700);
  assert.equal(meta.height, 900);
  const { data } = await sharp(result)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const offset = (400 * 700 + 350) * 3;
  assert.ok(Math.abs(data[offset] - 178) > 10, "服裝位置應與原始照片底色不同");
});
test("正式試穿 Adapter 在未授權時不會呼叫外部服務", async () => {
  await assert.rejects(
    new HttpTryonAdapter().generate({
      photo: Buffer.alloc(0),
      product: catalog[0],
      size: "M",
      color: "燕麥灰",
      profile,
    }),
    /授權/,
  );
});
test("正式推薦不接受未授權外傳，也不會悄悄降為 Demo", async () => {
  process.env.RECOMMENDATION_MODE = "ai";
  try {
    await assert.rejects(recommend("外套", catalog, profile, null), /授權/);
  } finally {
    delete process.env.RECOMMENDATION_MODE;
  }
});
test('正式推薦 HTTP 契約：不接受虛構商品、重複 ID 或模型捏造的商品事實', async()=>{
  let response={message:'一定合身，價格 9999',recommendations:[{product_id:'invented',reason:'價格 9999，一定合身'}]};
  let captured:Record<string,unknown>={};
  const server=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);captured=JSON.parse(Buffer.concat(chunks).toString());res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(response));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  process.env.RECOMMENDATION_MODE='ai';process.env.AI_RECOMMENDATION_KEY='test-secret';process.env.AI_RECOMMENDATION_URL=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try{
    await assert.rejects(recommend('外套',catalog,null,null,true),/商品庫以外/);
    response={...response,recommendations:[{product_id:'cloud-blazer',reason:'價格 9999，一定合身'}]};
    const result=await recommend('上台報告的外套',catalog,null,null,true);assert.equal(result.mode,'ai');assert.equal(captured.profile,null);assert.equal(captured.body,null);assert.doesNotMatch(result.recommendations[0].reason,/9999|一定合身/);assert.match(result.recommendations[0].reason,/不保證/);
    response.recommendations.push(response.recommendations[0]);await assert.rejects(recommend('外套',catalog,null,null,true),/重複/);
  }finally{delete process.env.RECOMMENDATION_MODE;delete process.env.AI_RECOMMENDATION_KEY;delete process.env.AI_RECOMMENDATION_URL;await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
