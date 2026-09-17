import zlib from 'node:zlib';

/**
 * 一个刚好够用的 ZIP 读取器。
 *
 * 为什么不装 fflate 之类的库：整条管线只需要「把 Epoch 的 zip 里的 CSV 读出来」
 * 这一个动作，而 zip 的中央目录格式二十多年没变过。为此多背一个依赖，
 * 换来的是将来某次上游改格式时多一处需要升级的第三方代码。
 * 这里只用 Node 自带的 zlib 解 deflate，读取逻辑不到一百行，且完全可测。
 *
 * 只支持 method 0（stored）与 method 8（deflate），这两种覆盖了 99.9% 的真实 zip。
 */

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

function findEocd(buf: Buffer): number {
  // EOCD 至少 22 字节，注释最长 65535，所以从尾部往回最多搜 22 + 65535 字节。
  const minPos = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= minPos; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

export class ZipArchive {
  private entries = new Map<string, ZipEntry>();
  private readonly buf: Buffer;

  constructor(buf: Buffer) {
    // 不用参数属性（constructor(private readonly buf)）：Node 的类型剥离
    // 只删类型不做代码生成，参数属性会直接报 ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX。
    // 保留 `node --experimental-strip-types` 可以直接跑通，就不必依赖 tsx。
    this.buf = buf;
    const eocd = findEocd(buf);
    if (eocd < 0) throw new Error('不是合法的 zip：找不到 EOCD 记录');
    const count = buf.readUInt16LE(eocd + 10);
    let ptr = buf.readUInt32LE(eocd + 16);

    for (let i = 0; i < count; i += 1) {
      if (buf.readUInt32LE(ptr) !== CEN_SIG) throw new Error(`中央目录第 ${i} 项签名不符`);
      const method = buf.readUInt16LE(ptr + 10);
      const compressedSize = buf.readUInt32LE(ptr + 20);
      const uncompressedSize = buf.readUInt32LE(ptr + 24);
      const nameLen = buf.readUInt16LE(ptr + 28);
      const extraLen = buf.readUInt16LE(ptr + 30);
      const commentLen = buf.readUInt16LE(ptr + 32);
      const localHeaderOffset = buf.readUInt32LE(ptr + 42);
      const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
      this.entries.set(name, { name, method, compressedSize, uncompressedSize, localHeaderOffset });
      ptr += 46 + nameLen + extraLen + commentLen;
    }
  }

  names(): string[] {
    return [...this.entries.keys()];
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  /** 按后缀取条目名，用于「不确定上游把 CSV 放在哪个子目录」的场景。 */
  findBySuffix(suffix: string): string | null {
    for (const name of this.entries.keys()) {
      if (name === suffix || name.endsWith(`/${suffix}`)) return name;
    }
    return null;
  }

  read(name: string): Buffer {
    const e = this.entries.get(name);
    if (!e) throw new Error(`zip 里没有 ${name}`);
    const off = e.localHeaderOffset;
    if (this.buf.readUInt32LE(off) !== LOC_SIG) throw new Error(`${name} 的本地头签名不符`);
    // 本地头的 nameLen/extraLen 可能与中央目录不同（extra field 常在两处不一致），
    // 所以必须重新读本地头的长度，不能复用中央目录的。
    const nameLen = this.buf.readUInt16LE(off + 26);
    const extraLen = this.buf.readUInt16LE(off + 28);
    const dataStart = off + 30 + nameLen + extraLen;
    const compressed = this.buf.subarray(dataStart, dataStart + e.compressedSize);

    if (e.method === 0) return Buffer.from(compressed);
    if (e.method === 8) return zlib.inflateRawSync(compressed);
    throw new Error(`${name} 用了不支持的压缩方式 ${e.method}`);
  }

  readText(name: string): string {
    return this.read(name).toString('utf8');
  }
}
