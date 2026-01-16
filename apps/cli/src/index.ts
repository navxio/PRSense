#!/usr/bin/env node
import "dotenv/config";
import { program } from "./program.js";

program.parse(process.argv);
