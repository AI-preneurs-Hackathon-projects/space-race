"use client";
import dynamic from "next/dynamic";
const CargoGame = dynamic(() => import("@/components/cargo-game"), { ssr: false });
export default function Home() { return <CargoGame />; }
