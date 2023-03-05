import { encodeToArrayBuffer } from "../../utilities/buffers/encoding";
import { Deserialiser } from "../types";
import { MemoryTarget } from "./target";
import { MemoryTargetSerialisationConfig, MemoryTargetType } from "./types";

export const MemoryTargetDeserialiser: Deserialiser<MemoryTargetType, MemoryTargetSerialisationConfig> = (config) =>
    Promise.resolve(
        config.type === "preserve"
            ? new MemoryTarget(
                  config.delaysInMillis,
                  true,
                  config.value && {
                      timestamp: config.value.timestamp,
                      buffer: encodeToArrayBuffer(config.value.encoded),
                  },
                  config.delayIndex
              )
            : new MemoryTarget(config.delaysInMillis, false)
    );
