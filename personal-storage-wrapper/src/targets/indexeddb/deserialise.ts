import { Deserialiser } from "../types";
import { IndexedDBTarget } from "./target";
import { IndexedDBTargetSerialisationConfig, IndexedDBTargetType } from "./types";

export const IndexedDBTargetDeserialiser: Deserialiser<IndexedDBTargetType, IndexedDBTargetSerialisationConfig> = ({
    id,
}) => IndexedDBTarget.create(id);
