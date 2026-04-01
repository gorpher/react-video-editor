type ZipEntry = {
  name: string;
  data: Uint8Array;
  lastModified?: Date;
};

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_VERSION = 20;
const ZIP_COMPRESSION_STORE = 0;

let crc32Table: Uint32Array | null = null;

function getCrc32Table() {
  if (crc32Table) return crc32Table;

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  crc32Table = table;
  return table;
}

function crc32(data: Uint8Array) {
  const table = getCrc32Table();
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i += 1) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;

  return { dosDate, dosTime };
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value & 0xffff, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function concatUint8Arrays(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return combined;
}

export function createZipArchive(entries: ZipEntry[]): Blob {
  const textEncoder = new TextEncoder();
  const fileChunks: Uint8Array[] = [];
  const centralDirectoryChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const fileData = entry.data;
    const crc = crc32(fileData);
    const { dosDate, dosTime } = toDosDateTime(entry.lastModified ?? new Date());

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localHeaderView = new DataView(localHeader.buffer);
    writeUint32(localHeaderView, 0, LOCAL_FILE_HEADER_SIGNATURE);
    writeUint16(localHeaderView, 4, ZIP_VERSION);
    writeUint16(localHeaderView, 6, 0);
    writeUint16(localHeaderView, 8, ZIP_COMPRESSION_STORE);
    writeUint16(localHeaderView, 10, dosTime);
    writeUint16(localHeaderView, 12, dosDate);
    writeUint32(localHeaderView, 14, crc);
    writeUint32(localHeaderView, 18, fileData.length);
    writeUint32(localHeaderView, 22, fileData.length);
    writeUint16(localHeaderView, 26, nameBytes.length);
    writeUint16(localHeaderView, 28, 0);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralHeaderView = new DataView(centralHeader.buffer);
    writeUint32(centralHeaderView, 0, CENTRAL_DIRECTORY_HEADER_SIGNATURE);
    writeUint16(centralHeaderView, 4, ZIP_VERSION);
    writeUint16(centralHeaderView, 6, ZIP_VERSION);
    writeUint16(centralHeaderView, 8, 0);
    writeUint16(centralHeaderView, 10, ZIP_COMPRESSION_STORE);
    writeUint16(centralHeaderView, 12, dosTime);
    writeUint16(centralHeaderView, 14, dosDate);
    writeUint32(centralHeaderView, 16, crc);
    writeUint32(centralHeaderView, 20, fileData.length);
    writeUint32(centralHeaderView, 24, fileData.length);
    writeUint16(centralHeaderView, 28, nameBytes.length);
    writeUint16(centralHeaderView, 30, 0);
    writeUint16(centralHeaderView, 32, 0);
    writeUint16(centralHeaderView, 34, 0);
    writeUint16(centralHeaderView, 36, 0);
    writeUint32(centralHeaderView, 38, 0);
    writeUint32(centralHeaderView, 42, offset);
    centralHeader.set(nameBytes, 46);

    fileChunks.push(localHeader, fileData);
    centralDirectoryChunks.push(centralHeader);
    offset += localHeader.length + fileData.length;
  }

  const centralDirectory = concatUint8Arrays(centralDirectoryChunks);
  const endOfCentralDirectory = new Uint8Array(22);
  const endView = new DataView(endOfCentralDirectory.buffer);
  writeUint32(endView, 0, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  const zipBytes = concatUint8Arrays([...fileChunks, centralDirectory, endOfCentralDirectory]);
  return new Blob([zipBytes], { type: "application/zip" });
}
