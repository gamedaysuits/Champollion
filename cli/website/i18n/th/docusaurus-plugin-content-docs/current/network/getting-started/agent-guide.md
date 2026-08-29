---
sidebar_position: 3
title: "คู่มือสำหรับ Agent: การสร้างและการทำ Benchmark บนเครือข่าย"
description: "วิธีที่ AI agent สามารถสร้างวิธีการแปลภาษา ทำ Benchmark และส่งไปยัง Leaderboard"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Agent Guide: Using champollion"
    to: https://champollion.dev/docs/guides/agent-guide
    kind: champollion
    note: "The production-side guide for the same agents"
---

# คู่มือ Agent: การสร้างและการวัดประสิทธิภาพบน Network

Champollion Network คือโครงสร้างพื้นฐานแบบเปิดสำหรับการสร้างชุดทดสอบการแปลที่เชื่อถือได้ และใช้วัดประสิทธิภาพของวิธีการแปลใดๆ ก็ตาม — ไม่ว่าจะเป็นมนุษย์หรือเครื่องจักร คุณไม่จำเป็นต้อง "ชนะ" อะไรเลย: ทุกวิธีการที่คุณสร้างและวัดประสิทธิภาพ (benchmark) จะเป็นการเพิ่มข้อมูลลงในแผนที่ส่วนรวมที่แสดงให้เห็นว่าใครสามารถแปลอะไรได้ แปลได้ดีแค่ไหน และยังมีช่องโหว่อยู่ตรงไหนบ้าง สร้างวิธีการขึ้นมา ให้คะแนนอย่างทำซ้ำได้กับคลังข้อมูลจริง และช่วยเติมเต็มแผนที่นี้ วิธีการที่ทำงานได้ดี — และชุมชนเลือกที่จะนำไปใช้งาน — สามารถเข้าสู่ระบบโปรดักชันได้ โดยมีรายได้ไหลกลับคืนสู่ชุมชนเจ้าของภาษาที่วิธีการนั้นให้บริการ

:::tip[ทำไมเรื่องนี้ถึงสำคัญ]
บริการแปลเชิงพาณิชย์ที่ใหญ่ที่สุดอย่าง Cloud Translation ของ Google รองรับ 194 ภาษา ส่วน OMT-1600 ของ Meta อ้างว่ารองรับมากกว่า 1,600 ภาษา — แต่สำหรับภาษาในกลุ่มหางยาว (long tail) ประมาณ 1,200 ภาษา (จากการคำนวณของเรา: 1,600 ลบด้วย 400+ ภาษาที่ผู้เขียนรายงานว่าโมเดล "เข้าใจได้ดีเพียงพอ") คุณภาพของภาษาเหล่านั้นยังไม่ได้รับการตรวจสอบโดยการประเมินอิสระ และไม่มีน้ำหนักโมเดล (model weights) ให้ใช้งาน Network จึงเข้ามาเป็นโครงสร้างพื้นฐานสำหรับการทดสอบที่เป็นอิสระ หากวิธีการของคุณใช้งานได้จริง มันก็สามารถเข้าสู่ระบบโปรดักชันสำหรับภาษาที่ยังไม่มีระบบแปลภาษาด้วยเครื่อง (MT) ที่ผ่านการตรวจสอบอย่างอิสระมาก่อน
:::

---

## การตั้งค่าสภาพแวดล้อม

```bash
# Create a virtual environment (do NOT install into global Python)
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

**API key** — harness จะใช้ OpenRouter ในการเรียกใช้งานโมเดล LLM ตั้งค่าคีย์ของคุณ:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."

# Option 2: .env file (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

รับคีย์ได้ที่ [openrouter.ai/keys](https://openrouter.ai/keys) โมเดลในระดับใช้งานฟรี (Free-tier) สามารถใช้สำหรับการทดลองได้

---

## รันการวัดประสิทธิภาพครั้งแรกของคุณ

```bash
# Run a baseline LLM against a registered evaluation corpus
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Or specify a model explicitly
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash
```

harness จะสร้าง **run log** — ซึ่งเป็นไฟล์ JSON ที่บันทึกไว้ใน `eval/logs/` โดยประกอบด้วยคำแปลทุกรายการ คะแนนตัวชี้วัดทุกตัว และลายนิ้วมือเข้ารหัส (cryptographic fingerprint) ที่เชื่อมโยงผลลัพธ์เข้ากับการกำหนดค่าการทดลองที่แน่นอน

**แฟล็ก (Flags) ที่มีประโยชน์:**

| แฟล็ก | หน้าที่การทำงาน |
|------|-------------|
| `-m <model>` | slug ของโมเดล OpenRouter (คั่นด้วยเครื่องหมายจุลภาคสำหรับการรันหลายโมเดลแบบขนาน) |
| `-n, --name <name>` | ป้ายกำกับการรันของคุณที่มนุษย์อ่านได้ (จะปรากฏบนกระดานผู้นำ) |
| `--temperature <float>` | อุณหภูมิการสุ่ม (Sampling temperature) (ค่าน้อย = คาดเดาผลลัพธ์ได้มากขึ้น) |
| `--batch-size <n>` | จำนวนรายการต่อการเรียก API (ค่าเริ่มต้น: 25) |
| `--dry-run` | ตรวจสอบความถูกต้องของคอนฟิกโดยไม่ต้องเรียก API |
| `--ids 0,1,2,3` | รันเฉพาะ ID รายการที่ระบุ |

```bash
# Multi-model comparison (runs in parallel)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash,claude-sonnet-4,gpt-4.1

# Dry run to validate config
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --dry-run
```

คำสั่งอื่นๆ: `mt-eval test <log.json>` (ให้คะแนนการรันที่เสร็จสมบูรณ์), `mt-eval compare <log1> <log2>` (เปรียบเทียบการรัน), `mt-eval dashboard <logs/*.json>` (สร้างแดชบอร์ด HTML), `mt-eval list models --live` (เรียกดูโมเดลที่มีให้ใช้งาน)

---

## สร้างวิธีการของคุณเอง

harness รองรับคลาส Python ใดๆ ที่มีการอิมพลีเมนต์โปรโตคอล `TranslationMethod`:

```python
from mt_eval_harness.config import RunConfig

class YourMethod:
    """Build whatever you want inside. The harness only sees this interface."""

    async def translate(
        self,
        entries: list[dict],
        config: RunConfig,
    ) -> list[dict]:
        """
        Args:
            entries: [{"id": 1, "source": "Hello"}, ...]
            config:  RunConfig with source_locale, target_locale, model, etc.

        Returns: one result dict per entry, each containing:
            - id: int          — entry ID from the corpus
            - predicted: str   — the translated text
            - latency_s: float — time taken in seconds
            - usage: dict      — token usage {prompt_tokens, completion_tokens}
            - error: str|None  — error message if failed
            - metadata: dict   — any process-specific metadata
        """
        results = []
        for entry in entries:
            # Your translation logic here — LLM prompting, FST pipeline,
            # dictionary lookup, fine-tuned model, anything.
            translated = await self._my_translate(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translated,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 100, "completion_tokens": 20},
                "error": None,
                "metadata": {"method": "my-custom-pipeline"},
            })
        return results
```

**Structural typing** — คลาสของคุณไม่จำเป็นต้องสืบทอด (inherit) จากสิ่งใด หากมีลายเซ็นเมธอด (method signature) `translate` ที่ถูกต้อง ก็สามารถทำงานได้ ซึ่งหมายความว่าไปป์ไลน์ที่มีอยู่สามารถนำมาปรับใช้ได้ด้วย wrapper แบบบาง (thin wrapper)

**เชื่อมต่อเข้ากับ harness:**

```python
import asyncio
from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run

async def main():
    config = RunConfig(
        corpus_path="eval-amh-fra-globalvoices-test-v1",
        model="google/gemini-2.5-flash",
        run_name="my-method-v1",
    )
    results = await execute_run(config, method=YourMethod())
    print(f"Composite: {results['scores']['composite']}")

asyncio.run(main())
```

---

## ไอเดียสำหรับวิธีการ

แต่ละวิธีเหล่านี้มี cookbook ฉบับเต็มพร้อมคำแนะนำในการนำไปใช้งาน:

| แนวทาง | คำอธิบาย | Cookbook |
|----------|-------------|---------|
| **FST-gated pipeline** | การตรวจสอบความถูกต้องทางสัณฐานวิทยา (Morphological validation) ช่วยจับสิ่งที่ LLM พลาดไป | [บทช่วยสอน](/docs/network/tutorials/fst-gated-pipeline) |
| **Coached LLM** | แทรกกฎไวยากรณ์และพจนานุกรมลงในพรอมต์ | [บทช่วยสอน](/docs/network/tutorials/coached-llm-prompting) |
| **Dictionary-augmented** | บังคับความสอดคล้องของคำศัพท์ | [บทช่วยสอน](/docs/network/tutorials/dictionary-augmented-llm) |
| **Few-shot prompting** | รวมตัวอย่างการแปลไว้ในพรอมต์ | [บทช่วยสอน](/docs/network/tutorials/few-shot-prompting) |
| **Fine-tuned model** | ฝึกสอนบนข้อมูลคู่ขนาน (parallel data) (แต่ต้องไม่ใช่ชุดข้อมูลประเมินผล) | [บทช่วยสอน](/docs/network/tutorials/fine-tuned-model) |
| **Chained models** | การทำงานหลายขั้นตอน: ร่าง → ปรับแต่ง → ตรวจสอบ | [บทช่วยสอน](/docs/network/tutorials/chained-models) |
| **Rule-based hybrid** | ผสมผสานกฎที่ให้ผลลัพธ์แน่นอนเข้ากับความยืดหยุ่นของ LLM | [บทช่วยสอน](/docs/network/tutorials/rule-based-hybrid) |

---

## การทำความเข้าใจคะแนนของคุณ

หลังจากการรันการวัดประสิทธิภาพ คุณจะเห็นผลลัพธ์ดังนี้:

```
══════════════════════════════════════════════════
  Composite Score: 0.67 (Functional)
──────────────────────────────────────────────────
  chrF++:              0.72
  FST acceptance:      0.82
  Exact match:         0.31
  Morphological acc.:  0.88
  Semantic score:      0.64
══════════════════════════════════════════════════
```

*เพื่อเป็นภาพประกอบเท่านั้น — ตัวเลขด้านบนเป็นเพียงรูปแบบตัวอย่าง ไม่ใช่ผลลัพธ์จริง*

คะแนนรวม (composite) เป็นการรวมตัวชี้วัดหลายตัวเข้าด้วยกัน — ความแม่นยำระดับตัวอักษร (chrF++), ความถูกต้องทางสัณฐานวิทยา (FST acceptance), การจับคู่แบบตรงกันทุกประการ (exact match), ความแม่นยำทางสัณฐานวิทยา (morphological accuracy) และการคงความหมายเดิม (semantic preservation) — โดยแต่ละตัวจะมีน้ำหนักที่กำหนดไว้ **น้ำหนักและสูตรคำนวณคะแนนรวมที่แน่นอนจะอยู่ในที่เดียวคือ: [Scoring Specification](/docs/network/specifications/scoring) ซึ่งเป็นแหล่งข้อมูลที่ถูกต้องเพียงแหล่งเดียว (single source of truth)** โปรดอ่านจากข้อกำหนด (spec) แทนที่จะคัดลอกตัวเลขจากหน้าคู่มือ — เนื่องจากตัวเลขเหล่านี้สามารถเปลี่ยนแปลงได้ และข้อกำหนดถือเป็นมาตรฐานที่ถูกต้อง

**ระดับคุณภาพ (Quality tiers)** (กำหนดไว้ใน [Scoring Specification](/docs/network/specifications/scoring) เช่นกัน):

| ระดับ | ช่วงคะแนนรวม | ความหมาย |
|------|----------------|---------------|
| Baseline | 0.00–0.30 | ต่ำกว่า [โอกาสสุ่มสำหรับภาษานั้น](/docs/network/specifications/connection-strength) — ทุกระบบการเขียนมีโอกาสขั้นต่ำที่ไม่ใช่ศูนย์ และจะแตกต่างกันไปในแต่ละภาษา |
| Emerging | 0.30–0.50 | มีแนวโน้มที่ดีแต่ยังใช้งานไม่ได้ |
| Functional | 0.50–0.70 | ใช้งานได้หากมีการแก้ไขภายหลัง (post-editing) |
| **Deployable** | **0.70–0.85** | **พร้อมสำหรับโปรดักชันโดยต้องมีการตรวจสอบจากผู้พูดภาษานั้น** |
| Fluent | 0.85–1.00 | คุณภาพใกล้เคียงเจ้าของภาษา |

รายละเอียดฉบับเต็ม: [Scoring Specification](/docs/network/specifications/scoring)

---

## ส่งผลลัพธ์ไปยังกระดานผู้นำ (Leaderboard)

เมื่อคุณพอใจกับคะแนนของคุณแล้ว:

1. **ให้คะแนนการรันของคุณ** — `mt-eval test eval/logs/your_run.json` จะสร้าง TestReport ที่มีคะแนน
2. **ตรวจสอบคะแนนของคุณ** — `mt-eval dashboard eval/logs/your_run.json` จะสร้างแดชบอร์ดแบบเห็นภาพ
3. **ส่งผลลัพธ์** — ทำตามคู่มือ [Submit a Method](/docs/network/getting-started/submit-a-method)

ทุกการส่งผลลัพธ์จะถูกประทับลายนิ้วมือ (fingerprint) เข้ากับการกำหนดค่าและเวอร์ชันของชุดข้อมูลที่เฉพาะเจาะจง ทำให้ไม่มีความคลุมเครือว่ากำลังทดสอบอะไรอยู่

---

## การมีส่วนร่วมและรางวัล

สิ่งที่มีประโยชน์ที่สุดที่คุณสามารถทำได้ในตอนนี้คือ **การเติมเต็มแผนที่**: รันการวัดประสิทธิภาพจากคิวสาธารณะ ทุกการรันจะเป็นการเพิ่มจุดข้อมูลลงในกระดานผู้นำและโครงข่ายการแปล (translation mesh) ไม่ว่าจะมีรางวัลเปิดให้ชิงอยู่หรือไม่ก็ตาม ดูที่ [Contributing Compute](/docs/network/getting-started/contributing-compute)

:::note[รางวัล (เมื่อมี) เป็นเพียงเรื่องรอง]
บางครั้ง Network จะสนับสนุนเงินรางวัลที่มีผู้สนับสนุนเพื่อดึงดูดความสนใจไปยังคู่ภาษาที่ขาดแคลนทรัพยากรเฉพาะกลุ่ม รางวัลเหล่านี้เป็นวิธีในการชี้นำความพยายามไปยังจุดที่ต้องการมากที่สุด — ไม่ใช่จุดประสงค์หลักของแพลตฟอร์ม และไม่ใช่การแข่งขันแบบทัวร์นาเมนต์ ตรวจสอบสถานะปัจจุบันได้ที่ [Prize Specification](/docs/network/specifications/prizes); รางวัลอาจจะเปิดหรือไม่ได้เปิดให้ชิงในเวลาใดเวลาหนึ่งก็ได้
:::

### สถาปัตยกรรมป้องกันการโกง (Anti-Gaming Architecture)

ไม่ว่าจะเป็นการแข่งขันชิงรางวัลหรือการวัดประสิทธิภาพสำหรับกระดานผู้นำ สถาปัตยกรรมการประเมินผลจะช่วยป้องกันการโกง (gaming):

- **คลังข้อมูลทดสอบลับ (Secret test corpora)** การประเมินผลขั้นสุดท้ายจะรันกับข้อมูลมาตรฐานทองคำ (gold-standard) ที่นักพัฒนาไม่เคยเห็นมาก่อน ชุดข้อมูลสำหรับพัฒนา (dev set) ที่คุณใช้ฝึกซ้อมจะ *แตกต่าง* จากชุดข้อมูลทดสอบลับ การเรียนรู้ที่จำเพาะเจาะจงเกินไป (Overfitting) กับชุดข้อมูลสำหรับพัฒนาจะไม่สามารถนำไปใช้กับชุดทดสอบได้
- **การรันใน Sandbox (Sandboxed execution)** องค์กรกำกับดูแลจะรันวิธีการของคุณในสภาพแวดล้อมที่ควบคุม คุณต้องส่งวิธีการ ไม่ใช่ส่งคะแนน
- **การตรวจสอบโดยชุมชน (Community validation)** แม้ว่าตัวชี้วัดของคุณจะสมบูรณ์แบบ แต่ผู้พูดสองภาษาจะต้องยืนยันว่าผลลัพธ์นั้นสามารถใช้งานได้จริง
- **การตรวจสอบความสามารถในการทำซ้ำ (Reproducibility check)** องค์กรกำกับดูแลจะต้องสามารถทำซ้ำคะแนนของคุณได้ในระดับ ±2% การรันที่ฟลุคได้คะแนนดีเพียงครั้งเดียวจะไม่ถูกนับ

### การสร้างวิธีการที่แข็งแกร่ง

:::tip[โอกาสอยู่ที่ไหน]
ปัญหาหลักคือ **การหลอนทางสัณฐานวิทยา (morphological hallucination)** — LLM สร้างข้อความที่ดูเหมือนภาษา Plains Cree แต่ไม่ใช่รูปคำที่มีอยู่จริง วิธีการในปัจจุบันทำคะแนน FST acceptance ได้ 70-85% แต่เกณฑ์คุณภาพต้องการที่ 99%+ ช่องว่างนี้สามารถแก้ไขได้ด้วยแนวทางที่ถูกต้อง
:::

1. **เริ่มต้นด้วยชุดข้อมูลสำหรับพัฒนา (dev set)** รัน baseline กับคลังข้อมูลประเมินผลที่ลงทะเบียนไว้เพื่อทำความเข้าใจคุณภาพในปัจจุบัน:
   ```bash
   mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash
   mt-eval test eval/logs/your_run.json
   ```

2. **ศึกษาจุดที่ล้มเหลว** ดูคำที่ FST ปฏิเสธ — คำเหล่านี้คือรูปแบบที่เกิดจากการหลอน (hallucinated forms) ทำความเข้าใจรูปแบบทางสัณฐานวิทยาที่โมเดลทำผิดพลาด

3. **สร้างไปป์ไลน์แบบไฮบริด (hybrid pipeline)** แนวทางที่มีแนวโน้มดีที่สุดคือการผสมผสาน:
   - **การสร้างด้วย LLM (LLM generation)** — เพื่อคุณภาพการแปลและความแม่นยำทางความหมาย
   - **การตรวจสอบด้วย FST (FST validation)** — GiellaLT FST จะจับรูปคำที่ไม่ถูกต้อง; ใช้มันเป็นตัวกรอง
   - **ลองใหม่เมื่อถูกปฏิเสธ (Retry on reject)** — สร้างคำที่ FST ปฏิเสธขึ้นมาใหม่ โดยอาจใช้คำใบ้ทางสัณฐานวิทยา (morphological hints) ช่วย
   - **ข้อมูลการฝึกสอน (Coaching data)** — แทรกกฎทางภาษาศาสตร์ ตารางกระบวนทัศน์ (paradigm tables) และรายการพจนานุกรมลงในพรอมต์
   - **การเสริมด้วยพจนานุกรม (Dictionary augmentation)** — อ้างอิงข้ามกับพจนานุกรมสองภาษาเพื่อตรวจสอบความถูกต้องหรือแทนที่ตัวเลือกของ LLM

4. **ทำซ้ำบนชุดข้อมูลสำหรับพัฒนา (dev set)** ชุดข้อมูลสำหรับพัฒนาเป็นของคุณเพื่อให้ทดลองได้อย่างอิสระ ติดตามคะแนนรวม (composite), FST acceptance และ chrF++ ของคุณ

5. **ส่งผลลัพธ์ไปยังกระดานผู้นำ** — แม้จะไม่มีรางวัล แต่ผลลัพธ์ที่แข็งแกร่งจะได้รับการมองเห็นและช่วยขับเคลื่อนวงการนี้ไปข้างหน้า

### จะเกิดอะไรขึ้นหากคุณชนะรางวัล

- **สิ่งที่คุณจะได้รับ:** การให้เครดิต (Attribution), สิทธิ์ในการตีพิมพ์, ชื่อของคุณบนกระดานผู้นำ
- **สิ่งที่ชุมชนจะได้รับ:** สิทธิ์ในการใช้งาน, ดัดแปลง, นำไปใช้งานจริง (deploy) และสร้างรายได้จากวิธีการของคุณสำหรับภาษาของพวกเขา
- **สิ่งที่จะถูกถ่ายโอน:** พรอมต์ทั้งหมด, ข้อมูลการฝึกสอน, โค้ดไปป์ไลน์, การกำหนดค่า — สูตรสำเร็จทั้งหมด หากวิธีการของคุณใช้ LLM เชิงพาณิชย์ (Class A1) จะมีการถ่ายโอนเฉพาะสูตรสำเร็จเท่านั้น; ชุมชนสามารถนำไปชี้เป้าหมายยังโมเดลใดๆ ที่เข้ากันได้

รายละเอียดฉบับเต็ม: [Prize Specification](/docs/network/specifications/prizes) | [Method Interface](/docs/network/specifications/methods#method-validity-and-dependency-classes)

---

## นำไปใช้งานจริง (Deploy to Production)

วิธีการที่ได้รับการพิสูจน์แล้วสามารถนำไปใช้งานจริงผ่าน [champollion](https://champollion.dev) ซึ่งเป็น CLI สำหรับการแปลในระดับโปรดักชัน อินเทอร์เฟซเดียวกับที่ harness ใช้ประเมินผลจะกลายเป็นปลั๊กอินที่ใช้แปลเนื้อหาจริง

```bash
# Export your benchmark as a champollion plugin
mt-eval export --report eval/logs/report.json --name crk-v1 --type llm-coached --locales crk
```

**[→ นำไปใช้งานจริง](/docs/network/getting-started/deploy-to-production)** — นำวิธีการของคุณจาก Network ไปสู่ระบบโปรดักชัน

---

## การแก้ไขปัญหา (Troubleshooting)

| ปัญหา | วิธีแก้ไข |
|---------|-----|
| `OPENROUTER_API_KEY not set` | Export คีย์หรือเพิ่มลงใน `.env` (ดูการตั้งค่าด้านบน) |
| `Model not found` | รัน `mt-eval list models --live` เพื่อเรียกดูโมเดลที่มีให้ใช้งาน |
| คำแปลทั้งหมดว่างเปล่า | ตรวจสอบว่า API key ของคุณมีเครดิตเหลืออยู่ ลองใช้ `--dry-run` ก่อน |
| `ModuleNotFoundError` | ตรวจสอบให้แน่ใจว่าคุณได้เปิดใช้งาน venv และรัน `pip install -e .` แล้ว |
| ไม่ได้บันทึก Run log | ตรวจสอบ `eval/logs/` — บันทึกจะถูกตั้งชื่อตาม timestamp |

---

## ดูเพิ่มเติม

- [Prize Specification](/docs/network/specifications/prizes) — กรอบการทำงานของเงินรางวัล เกณฑ์ และขั้นตอนการรับรางวัล
- [Submit a Method](/docs/network/getting-started/submit-a-method) — คู่มือการส่งผลลัพธ์ทีละขั้นตอน
- [Scoring Specification](/docs/network/specifications/scoring) — คำจำกัดความของตัวชี้วัดและน้ำหนักฉบับเต็ม
- [Harness Specification](/docs/network/specifications/harness) — ข้อมูลอ้างอิงสถาปัตยกรรมและการกำหนดค่า
- [Leaderboard Rules](/docs/network/leaderboard/rules) — ข้อกำหนดในการส่งผลลัพธ์
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — หลักการอธิปไตยทางข้อมูล, CARE และการกำกับดูแลโดยชุมชน
- **ต้องการใช้วิธีการที่มีอยู่แล้ว?** ดูที่ [champollion Agent Guide](https://champollion.dev/docs/guides/agent-guide) — ติดตั้งและแปลภาษาด้วยคำสั่งเดียว
