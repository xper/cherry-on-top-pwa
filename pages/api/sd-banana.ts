// import * as banana from "@banana-dev/banana-dev";
import type { NextApiRequest, NextApiResponse } from "next";
import Auth from "gongo-server/lib/auth-class";
import GongoServer from "gongo-server/lib/serverless";
import Database /* ObjectID */ from "gongo-server-db-mongo";
import { v4 as uuidv4 } from "uuid";

import type { BananaRequest } from "../../src/schemas/bananaRequest";
import stableDiffusionInputsSchema from "../../src/schemas/stableDiffusionInputs";
import type { StableDiffusionInputs } from "../../src/schemas/stableDiffusionInputs";
import { REQUIRE_REGISTRATION } from "../../src/lib/server-env";
import bananaCallInputsSchema, {
  BananaCallInputs,
} from "../../src/schemas/bananaCallInputs";
import bananaUrl from "../../src/lib/bananaUrl";
import models from "../../src/config/models";

// const CREDIT_COST = 1;

const apiKey = process.env.BANANA_API_KEY;

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1";

const gs = new GongoServer({
  dba: new Database(MONGO_URL, "sd-mui"),
});

async function bananaSdkRun(
  modelInputs: StableDiffusionInputs,
  callInputs: BananaCallInputs,
  chargedCredits: { credits: number; paid: boolean }
) {
  if (typeof apiKey !== "string")
    throw new Error("process.env.BANANA_API_KEY is not a string");

  const PROVIDER_ID = callInputs.PROVIDER_ID;

  const BANANA_API_URL = bananaUrl(PROVIDER_ID);
  console.log({ BANANA_API_URL });

  let envName = "BANANA_MODEL_KEY_SD";
  switch (callInputs.MODEL_ID) {
    case "stabilityai/stable-diffusion-2-1-base":
      envName += "_v2_1_512";
      break;
    case "stabilityai/stable-diffusion-2-1":
      envName += "_v2_1_768";
      break;
    case "stabilityai/stable-diffusion-2-base":
      envName += "_v2_0_512";
      break;
    case "stabilityai/stable-diffusion-2":
      envName += "_v2_0_768";
      break;
    case "CompVis/stable-diffusion-v1-4":
      envName += "_v1_4";
      break;
    case "runwayml/stable-diffusion-v1-5":
      envName += "_v1_5";
      break;
    case "runwayml/stable-diffusion-inpainting":
      envName += "_INPAINT";
      break;
    case "hakurei/waifu-diffusion":
      envName += "_WAIFU";
      break;
    case "hakurei/waifu-diffusion-v1-3":
      envName += "_WAIFU_v1_3";
      // @ts-expect-error: ok
      callInputs.CHECKPOINT_URL =
        "https://huggingface.co/hakurei/waifu-diffusion-v1-3/resolve/main/wd-v1-3-float16.ckpt";
      break;
    case "hakurei/waifu-diffusion-v1-3-full":
      envName += "_WAIFU_v1_3_full";
      callInputs.MODEL_ID = "hakurei/waifu-diffusion-v1-3";
      break;
    case "wd-1-4-anime_e1":
      envName += "_WAIFU_v1_3_e1";
      break;
    case "Linaqruf/anything-v3.0":
      envName += "_ANYTHING_v3_0";
      break;
    case "rinna/japanese-stable-diffusion":
      envName += "_JP";
      break;
  }

  const modelKey = PROVIDER_ID === 2 ? "dda" : process.env[envName];

  console.log({
    var: envName,
    key: modelKey,
  });

  if (typeof modelKey !== "string")
    throw new Error(`${envName} is not a string`);

  /*
    {
      id: '236f1501-d363-4a8d-adcc-71e036126741',
      message: 'success',
      created: 1661936807,
      apiVersion: '28 July 2022',
      modelOutputs: [
        {
          image_base64: '/9j/4AAQSkZ....'
        }
      ]
    }
  */
  /*
    message: '',
    modelOutputs: [ { message: "No prompt provided" } ]
  */

  // const out = await banana.run(apiKey, modelKey, modelOpts);
  // const id = await banana.start(apiKey, modelKey, modelOpts);

  const now = new Date();

  const startRequestId = uuidv4();

  const payload = {
    id: startRequestId,
    created: Math.floor(now.getTime() / 1000),
    apiKey,
    modelKey,
    modelInputs: { modelInputs, callInputs },
    startOnly: true,
  };

  callInputs.startRequestId = startRequestId;

  const response = await fetch(BANANA_API_URL + "/start/v4/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // TODO, error handling `:)

  const result = await response.json();
  const callID = result.callID;

  // fs.writeFileSync("out.json", JSON.stringify(out));
  // console.log(out);
  // const out = JSON.parse(fs.readFileSync("out.json").toString("utf-8"));

  if (modelInputs.init_image) modelInputs.init_image = "[truncated]";
  if (modelInputs.mask_image) modelInputs.mask_image = "[truncated]";

  const bananaRequest: BananaRequest = {
    // bananaId: result.id,
    modelKey,
    callID,
    startRequestId,
    createdAt: now,
    apiVersion: result.apiVersion,
    message: result.message,
    finished: result.finished,
    modelInputs,
    callInputs,
    steps: {},
    ...chargedCredits,
  };

  if (REQUIRE_REGISTRATION && gs && gs.dba)
    await gs.dba.collection("bananaRequests").insertOne(bananaRequest);

  return result;
}

async function localSdkRun(
  modelInputs: StableDiffusionInputs,
  callInputs: BananaCallInputs
) {
  const created = Math.floor(Date.now() / 1000);

  const response = await fetch("http://localhost:8000", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ modelInputs, callInputs }),
    // body: JSON.stringify({ ...modelInputs, ...callInputs }), // for now
  });

  const data = await response.json();

  // Now we return it in the same way Banana's SDK would
  return {
    id: "UID todo",
    // Up until now, every { message: "something" } has been a failure.
    message: data.message ? "" : "success",
    created,
    apiVersion: "local dev",
    modelOutputs: [data],
  };
}

const runners = {
  "banana-local": localSdkRun,
  "banana-remote": bananaSdkRun,
};

const shorten = (str: string) =>
  str.substring(0, 5) + "...[snip]..." + str.substring(str.length - 5);

function log(out: Record<string, unknown>) {
  console.log(
    JSON.stringify(
      out,
      function replacer(key, value) {
        if (key.endsWith("_image") || key.startsWith("image_"))
          return shorten(value);
        return value;
      },
      2
    )
  );
}

export default async function SDBanana(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") throw new Error("expected a POST");
  if (typeof req.body !== "object") throw new Error("Body not decoded");
  if (!req.body.modelInputs) throw new Error("No modelInputs provided");

  // On the client-side we use .cast(), here we use .validate()
  let modelInputs, callInputs;
  try {
    modelInputs = await stableDiffusionInputsSchema.validate(
      req.body.modelInputs
    );
    callInputs = await bananaCallInputsSchema.validate(req.body.callInputs);
  } catch (error) {
    let message = "Validation Failure";
    if (error instanceof Error) message = error.message;
    console.log(error);
    return res.status(200).send({ $error: { message } });
  }
  const fetchOpts = req.body.fetchOpts || {};

  const model = callInputs.MODEL_ID && models[callInputs.MODEL_ID];

  if (callInputs.MODEL_ID === "rinna/japanese-stable-diffusion")
    callInputs.PIPELINE = "Japanese" + callInputs.PIPELINE;

  log({ modelInputs, callInputs, fetchOpts });

  let credits;
  const chargedCredits = { credits: 0, paid: false };
  if (REQUIRE_REGISTRATION) {
    if (!fetchOpts.auth)
      return res.status(400).end("Forbidden, no fetchOpts.auth");
    if (!gs.dba) throw new Error("gs.dba not defined");

    const auth = new Auth(gs.dba, fetchOpts.auth);
    console.log({ fetchOptsAuth: fetchOpts.auth });
    console.log({ sessionData: await auth.getSessionData() });
    const userId = await auth.userId();
    console.log({ userId });

    if (!userId) {
      return res.status(403).send("Forbidden, no userId");
    }

    const user = await gs.dba.collection("users").findOne({ _id: userId });
    if (!user) return res.status(500).send("Server error");

    let CREDIT_COST = 1;
    if (callInputs.PROVIDER_ID === 2) {
      CREDIT_COST = 0.25;
      callInputs.MODEL_URL = "s3://";
      // @ts-expect-error: send, but don't ever validate (for now)
      callInputs.MODEL_PRECISION = model.MODEL_PRECISION ?? "fp16";
      // @ts-expect-error: ok
      callInputs.MODEL_REVISION = model.MODEL_REVISION ?? "fp16";

      if (callInputs.MODEL_ID === "wd-1-4-anime_e1") {
        callInputs.MODEL_URL =
          "s3:///diffusers/models--wd-1-4-anime_e1.tar.zst";
        // @ts-expect-error: send, but don't ever validate (for now)
        callInputs.MODEL_PRECISION = "";
        // @ts-expect-error: ok
        callInputs.MODEL_REVISION = "";
      } else if (callInputs.MODEL_ID === "prompthero/openjourney-v2") {
        // @ts-expect-error: send, but don't ever validate (for now)
        callInputs.MODEL_PRECISION = "";
        // @ts-expect-error: ok
        callInputs.MODEL_REVISION = "";
      }
    }

    if (fetchOpts.dest === "banana-local" || callInputs.PROVIDER_ID === 2) {
      if (callInputs.PIPELINE === "StableDiffusionPipeline") {
        callInputs.PIPELINE = "lpw_stable_diffusion";
        callInputs.custom_pipeline_method = "text2img";
      } else if (callInputs.PIPELINE === "StableDiffusionImg2ImgPipeline") {
        callInputs.PIPELINE = "lpw_stable_diffusion";
        callInputs.custom_pipeline_method = "img2img";
      } else if (callInputs.PIPELINE === "StableDiffusionInpaintPipeline") {
        callInputs.PIPELINE = "lpw_stable_diffusion";
        callInputs.custom_pipeline_method = "inpaint";
      }
    }

    if (!(user.credits.free >= CREDIT_COST || user.credits.paid >= CREDIT_COST))
      return res.status(403).send("Out of credits");

    if (user.credits.free >= CREDIT_COST) {
      user.credits.free -= CREDIT_COST;
      chargedCredits.credits = CREDIT_COST;
      await gs.dba
        .collection("users")
        .updateOne({ _id: userId }, { $inc: { "credits.free": -CREDIT_COST } });
    } else {
      user.credits.paid -= CREDIT_COST;
      chargedCredits.credits = CREDIT_COST;
      chargedCredits.paid = true;
      await gs.dba
        .collection("users")
        .updateOne({ _id: userId }, { $inc: { "credits.paid": -CREDIT_COST } });
    }

    credits = user.credits;

    const userRequest = {
      userId,
      date: new Date(),
      ...chargedCredits,
      callInputs,
      modelInputs: {
        ...modelInputs,
      },
      ...chargedCredits,
    };
    delete userRequest.modelInputs.prompt;
    delete userRequest.modelInputs.negative_prompt;
    delete userRequest.modelInputs.image;
    delete userRequest.modelInputs.mask_image;
    delete userRequest.modelInputs.init_image;
    await gs.dba.collection("userRequests").insertOne(userRequest);
  }

  // Let's just be sure until we sort this properly

  // @ts-expect-error: doesn't exist, need to fix as above
  if (modelInputs.randomizeSeed) {
    // @ts-expect-error: doesn't exist, need to fix as above
    delete modelInputs.randomizeSeed;
    console.log("! Removed modelInputs.randomizeSeed - TODO");
  }
  // @ts-expect-error: doesn't exist, need to fix as above
  if (modelInputs.shareInputs) {
    // @ts-expect-error: doesn't exist, need to fix as above
    delete modelInputs.shareInputs;
    console.log("! Removed modelInputs.shareInputs - TODO");
  }
  if (modelInputs.sampler) {
    delete modelInputs.sampler;
    console.log("! Removed modelInputs.sampler - TODO");
  }

  if (modelInputs.init_image) {
    modelInputs.image = modelInputs.init_image;
    delete modelInputs.init_image;
  }

  if (callInputs.MODEL_ID !== "rinna/japanese-stable-diffusion") {
    if (callInputs.PIPELINE === "StableDiffusionInpaintPipeline")
      callInputs.PIPELINE = "StableDiffusionInpaintPipelineLegacy";
  }

  // @ts-expect-error: TODO
  const runner = runners[fetchOpts.dest];

  const out = await runner(modelInputs, callInputs, chargedCredits);
  if (REQUIRE_REGISTRATION) out.credits = credits;

  log(out);

  res.status(200).json(out);
}
