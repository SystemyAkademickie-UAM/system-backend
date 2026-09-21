import { crc32 } from 'zlib';

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_VERSION = 20;
const ZIP_STORE_METHOD = 0;
const ZIP_LOCAL_HEADER_LENGTH = 30;
const ZIP_CENTRAL_HEADER_LENGTH = 46;
const ZIP_EOCD_LENGTH = 22;

export type ZipStoreEntry = {
  name: string;
  data: Buffer;
};

/**
 * PKZIP store (no extra compression) for already-gzipped daily files.
 */
export class LogZipStore {
  static build(entries: ZipStoreEntry[]): Buffer {
    const localChunks: Buffer[] = [];
    const centralChunks: Buffer[] = [];
    let offset = 0;
    for (const entry of entries) {
      const nameBytes = Buffer.from(entry.name, 'utf8');
      const checksum = crc32(entry.data);
      const localHeader = Buffer.alloc(ZIP_LOCAL_HEADER_LENGTH);
      localHeader.writeUInt32LE(ZIP_LOCAL_SIGNATURE, 0);
      localHeader.writeUInt16LE(ZIP_VERSION, 4);
      localHeader.writeUInt16LE(ZIP_STORE_METHOD, 8);
      localHeader.writeUInt32LE(checksum, 14);
      localHeader.writeUInt32LE(entry.data.length, 18);
      localHeader.writeUInt32LE(entry.data.length, 22);
      localHeader.writeUInt16LE(nameBytes.length, 26);
      const localRecord = Buffer.concat([localHeader, nameBytes, entry.data]);
      const centralHeader = Buffer.alloc(ZIP_CENTRAL_HEADER_LENGTH);
      centralHeader.writeUInt32LE(ZIP_CENTRAL_SIGNATURE, 0);
      centralHeader.writeUInt16LE(ZIP_VERSION, 4);
      centralHeader.writeUInt16LE(ZIP_VERSION, 6);
      centralHeader.writeUInt16LE(ZIP_STORE_METHOD, 10);
      centralHeader.writeUInt32LE(checksum, 16);
      centralHeader.writeUInt32LE(entry.data.length, 20);
      centralHeader.writeUInt32LE(entry.data.length, 24);
      centralHeader.writeUInt16LE(nameBytes.length, 28);
      centralHeader.writeUInt32LE(offset, 42);
      localChunks.push(localRecord);
      centralChunks.push(Buffer.concat([centralHeader, nameBytes]));
      offset += localRecord.length;
    }
    const centralDirectory = Buffer.concat(centralChunks);
    const eocd = Buffer.alloc(ZIP_EOCD_LENGTH);
    eocd.writeUInt32LE(ZIP_EOCD_SIGNATURE, 0);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralDirectory.length, 12);
    eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([...localChunks, centralDirectory, eocd]);
  }

  static listNames(zip: Buffer): string[] {
    return this.readAllEntries(zip).map((entry) => entry.name);
  }

  static readEntry(zip: Buffer, name: string): Buffer | null {
    const found = this.readAllEntries(zip).find((entry) => entry.name === name);
    return found === undefined ? null : found.data;
  }

  static readAllEntries(zip: Buffer): ZipStoreEntry[] {
    const eocdOffset = this.findEocdOffset(zip);
    const entryCount = zip.readUInt16LE(eocdOffset + 10);
    let cursor = zip.readUInt32LE(eocdOffset + 16);
    const entries: ZipStoreEntry[] = [];
    for (let i = 0; i < entryCount; i += 1) {
      if (zip.readUInt32LE(cursor) !== ZIP_CENTRAL_SIGNATURE) {
        throw new Error('Invalid zip central directory');
      }
      const nameLength = zip.readUInt16LE(cursor + 28);
      const extraLength = zip.readUInt16LE(cursor + 30);
      const commentLength = zip.readUInt16LE(cursor + 32);
      const localOffset = zip.readUInt32LE(cursor + 42);
      const name = zip.subarray(cursor + ZIP_CENTRAL_HEADER_LENGTH, cursor + ZIP_CENTRAL_HEADER_LENGTH + nameLength).toString('utf8');
      entries.push({ name, data: this.readLocalData(zip, localOffset) });
      cursor += ZIP_CENTRAL_HEADER_LENGTH + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  private static findEocdOffset(zip: Buffer): number {
    for (let i = zip.length - ZIP_EOCD_LENGTH; i >= 0; i -= 1) {
      if (zip.readUInt32LE(i) === ZIP_EOCD_SIGNATURE) {
        return i;
      }
    }
    throw new Error('Zip end of central directory not found');
  }

  private static readLocalData(zip: Buffer, localOffset: number): Buffer {
    if (zip.readUInt32LE(localOffset) !== ZIP_LOCAL_SIGNATURE) {
      throw new Error('Invalid zip local header');
    }
    const nameLength = zip.readUInt16LE(localOffset + 26);
    const extraLength = zip.readUInt16LE(localOffset + 28);
    const dataLength = zip.readUInt32LE(localOffset + 22);
    const dataStart = localOffset + ZIP_LOCAL_HEADER_LENGTH + nameLength + extraLength;
    return zip.subarray(dataStart, dataStart + dataLength);
  }
}
