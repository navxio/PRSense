import { ContextQuery } from "../model/ContextQuery.js";
import { RetrievedContext } from "../model/RetrievedContext.js";

export type ContextRetriever = (
  query: ContextQuery,
) => Promise<RetrievedContext>;
