"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { DesignImage, DesignPayload, TextLine } from "@/lib/design";
import { fitCoverInFrame } from
