"use client";
import dynamic from "next/dynamic";
const Village3D = dynamic(() => import("./Village3D"), { ssr: false });
export default function FondScene() { return <Village3D />; }
