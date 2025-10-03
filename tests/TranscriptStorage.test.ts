import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, bufferCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_ALREADY_EXISTS = 101;
const ERR_NOT_FOUND = 102;
const ERR_INVALID_METADATA = 103;
const ERR_INVALID_OWNER = 104;
const ERR_INVALID_INSTITUTION = 105;
const ERR_REVOKED_ALREADY = 106;
const ERR_UPDATE_NOT_ALLOWED = 107;
const ERR_INVALID_DEGREE = 110;
const ERR_INVALID_GPA = 111;
const ERR_INVALID_COURSES = 112;
const ERR_MAX_TRANSCRIPTS_EXCEEDED = 109;
const ERR_AUTHORITY_NOT_VERIFIED = 113;

interface Transcript {
  owner: string;
  institution: string;
  metadata: string;
  degree: string;
  gpa: number;
  courses: number[];
  issuedAt: number;
  revoked: boolean;
  status: boolean;
}

interface TranscriptUpdate {
  updateMetadata: string;
  updateGpa: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class TranscriptStorageMock {
  state: {
    nextTranscriptId: number;
    maxTranscripts: number;
    storageFee: number;
    authorityContract: string | null;
    transcripts: Map<string, Transcript>;
    transcriptsByOwner: Map<string, { transcriptId: string }[]>;
    transcriptUpdates: Map<string, TranscriptUpdate>;
  } = {
    nextTranscriptId: 0,
    maxTranscripts: 500,
    storageFee: 500,
    authorityContract: null,
    transcripts: new Map(),
    transcriptsByOwner: new Map(),
    transcriptUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextTranscriptId: 0,
      maxTranscripts: 500,
      storageFee: 500,
      authorityContract: null,
      transcripts: new Map(),
      transcriptsByOwner: new Map(),
      transcriptUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setStorageFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.storageFee = newFee;
    return { ok: true, value: true };
  }

  storeTranscript(
    transcriptId: string,
    owner: string,
    metadata: string,
    degree: string,
    gpa: number,
    courses: number[]
  ): Result<boolean> {
    if (this.state.nextTranscriptId >= this.state.maxTranscripts) return { ok: false, value: ERR_MAX_TRANSCRIPTS_EXCEEDED };
    if (!metadata || metadata.length > 200) return { ok: false, value: ERR_INVALID_METADATA };
    if (owner === this.caller) return { ok: false, value: ERR_INVALID_OWNER };
    if (!["Bachelor", "Master", "PhD"].includes(degree)) return { ok: false, value: ERR_INVALID_DEGREE };
    if (gpa < 0 || gpa > 40) return { ok: false, value: ERR_INVALID_GPA };
    if (courses.length > 10) return { ok: false, value: ERR_INVALID_COURSES };
    if (this.state.transcripts.has(transcriptId)) return { ok: false, value: ERR_ALREADY_EXISTS };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.storageFee, from: this.caller, to: this.state.authorityContract });

    const transcript: Transcript = {
      owner,
      institution: this.caller,
      metadata,
      degree,
      gpa,
      courses,
      issuedAt: this.blockHeight,
      revoked: false,
      status: true,
    };
    this.state.transcripts.set(transcriptId, transcript);
    let ownerList = this.state.transcriptsByOwner.get(owner) || [];
    ownerList.push({ transcriptId });
    if (ownerList.length > 100) ownerList = ownerList.slice(-100);
    this.state.transcriptsByOwner.set(owner, ownerList);
    this.state.nextTranscriptId++;
    return { ok: true, value: true };
  }

  getTranscript(transcriptId: string): Transcript | null {
    return this.state.transcripts.get(transcriptId) || null;
  }

  revokeTranscript(transcriptId: string): Result<boolean> {
    const transcript = this.state.transcripts.get(transcriptId);
    if (!transcript) return { ok: false, value: ERR_NOT_FOUND };
    if (transcript.institution !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (transcript.revoked) return { ok: false, value: ERR_REVOKED_ALREADY };
    const updated: Transcript = { ...transcript, revoked: true, status: false };
    this.state.transcripts.set(transcriptId, updated);
    return { ok: true, value: true };
  }

  updateTranscript(transcriptId: string, updateMetadata: string, updateGpa: number): Result<boolean> {
    const transcript = this.state.transcripts.get(transcriptId);
    if (!transcript) return { ok: false, value: ERR_NOT_FOUND };
    if (transcript.owner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (transcript.revoked) return { ok: false, value: ERR_UPDATE_NOT_ALLOWED };
    if (!updateMetadata || updateMetadata.length > 200) return { ok: false, value: false };
    if (updateGpa < 0 || updateGpa > 40) return { ok: false, value: false };
    const updated: Transcript = {
      ...transcript,
      metadata: updateMetadata,
      gpa: updateGpa,
    };
    this.state.transcripts.set(transcriptId, updated);
    this.state.transcriptUpdates.set(transcriptId, {
      updateMetadata,
      updateGpa,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getTranscriptCount(): Result<number> {
    return { ok: true, value: this.state.nextTranscriptId };
  }

  checkTranscriptExistence(transcriptId: string): Result<boolean> {
    return { ok: true, value: this.state.transcripts.has(transcriptId) };
  }
}

describe("TranscriptStorage", () => {
  let contract: TranscriptStorageMock;

  beforeEach(() => {
    contract = new TranscriptStorageMock();
    contract.reset();
  });

  it("stores a transcript successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.storeTranscript(
      "tx123",
      "ST3STUDENT",
      "BS in CS, issued 2023",
      "Bachelor",
      35,
      [101, 102]
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const transcript = contract.getTranscript("tx123");
    expect(transcript?.owner).toBe("ST3STUDENT");
    expect(transcript?.institution).toBe("ST1TEST");
    expect(transcript?.metadata).toBe("BS in CS, issued 2023");
    expect(transcript?.degree).toBe("Bachelor");
    expect(transcript?.gpa).toBe(35);
    expect(transcript?.courses).toEqual([101, 102]);
    expect(transcript?.revoked).toBe(false);
    expect(transcript?.status).toBe(true);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate transcript id", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.storeTranscript(
      "tx123",
      "ST3STUDENT",
      "BS in CS, issued 2023",
      "Bachelor",
      35,
      [101, 102]
    );
    const result = contract.storeTranscript(
      "tx123",
      "ST4STUDENT",
      "MS in AI, issued 2024",
      "Master",
      38,
      [201, 202, 203]
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_EXISTS);
  });

  it("rejects non-authorized institution", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const result = contract.storeTranscript(
      "tx456",
      "ST3STUDENT",
      "BS in CS, issued 2023",
      "Bachelor",
      35,
      [101, 102]
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid degree", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.storeTranscript(
      "tx789",
      "ST3STUDENT",
      "BS in CS, issued 2023",
      "Invalid",
      35,
      [101, 102]
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DEGREE);
  });

  it("revokes a transcript successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.storeTranscript(
      "tx123",
      "ST3STUDENT",
      "BS in CS, issued 2023",
      "Bachelor",
      35,
      [101, 102]
    );
    const result = contract.revokeTranscript("tx123");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const transcript = contract.getTranscript("tx123");
    expect(transcript?.revoked).toBe(true);
    expect(transcript?.status).toBe(false);
  });

  it("rejects revoke for non-existent transcript", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.revokeTranscript("tx999");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_FOUND);
  });

  it("updates a transcript successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.storeTranscript(
      "tx123",
      "ST3STUDENT",
      "BS in CS, issued 2023",
      "Bachelor",
      35,
      [101, 102]
    );
    contract.caller = "ST3STUDENT";
    const result = contract.updateTranscript("tx123", "Updated metadata", 36);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const transcript = contract.getTranscript("tx123");
    expect(transcript?.metadata).toBe("Updated metadata");
    expect(transcript?.gpa).toBe(36);
    const update = contract.state.transcriptUpdates.get("tx123");
    expect(update?.updateMetadata).toBe("Updated metadata");
    expect(update?.updateGpa).toBe(36);
    expect(update?.updater).toBe("ST3STUDENT");
  });

  it("rejects update for revoked transcript", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.storeTranscript(
      "tx123",
      "ST3STUDENT",
      "BS in CS, issued 2023",
      "Bachelor",
      35,
      [101, 102]
    );
    contract.revokeTranscript("tx123");
    contract.caller = "ST3STUDENT";
    const result = contract.updateTranscript("tx123", "Updated metadata", 36);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UPDATE_NOT_ALLOWED);
  });

  it("sets storage fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setStorageFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.storageFee).toBe(1000);
    contract.storeTranscript(
      "tx123",
      "ST3STUDENT",
      "BS in CS, issued 2023",
      "Bachelor",
      35,
      [101, 102]
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("returns correct transcript count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.storeTranscript(
      "tx1",
      "ST3STUDENT",
      "BS in CS",
      "Bachelor",
      35,
      [101]
    );
    contract.storeTranscript(
      "tx2",
      "ST4STUDENT",
      "MS in AI",
      "Master",
      38,
      [201, 202]
    );
    const result = contract.getTranscriptCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks transcript existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.storeTranscript(
      "tx123",
      "ST3STUDENT",
      "BS in CS",
      "Bachelor",
      35,
      [101]
    );
    let result = contract.checkTranscriptExistence("tx123");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    result = contract.checkTranscriptExistence("tx999");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(false);
  });

  it("rejects store without authority contract", () => {
    const result = contract.storeTranscript(
      "tx123",
      "ST3STUDENT",
      "BS in CS",
      "Bachelor",
      35,
      [101]
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid gpa", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.storeTranscript(
      "tx123",
      "ST3STUDENT",
      "BS in CS",
      "Bachelor",
      41,
      [101]
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_GPA);
  });

  it("rejects max transcripts exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxTranscripts = 1;
    contract.storeTranscript(
      "tx1",
      "ST3STUDENT",
      "BS in CS",
      "Bachelor",
      35,
      [101]
    );
    const result = contract.storeTranscript(
      "tx2",
      "ST4STUDENT",
      "MS in AI",
      "Master",
      38,
      [201]
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_TRANSCRIPTS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});