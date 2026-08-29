---
sidebar_position: 2
title: "여기서 언어란 무엇을 의미하나요?"
---

# 여기서 언어로 인정되는 것은 무엇인가요?

> **핵심 요약.** Network는 ISO 639-3에 따라 언어를 분류하고, (macrolanguage 우산 분류가 아닌) 개별 언어를 벤치마킹하며, 수어를 그 자체로 자연어로서 포함하고, ISO가 인정하는 인공어를 포함하며, 프로그래밍 언어는 제외하고, 분류 분쟁을 어느 한쪽 편을 들지 않고 표시해요. 이 페이지는 각각의 선택과 그것이 리더보드에 어떤 의미를 갖는지 설명해요.

수천 개의 언어에 걸쳐 번역을 벤치마킹하는 모든 프로젝트는 오래되고 의외로 어려운 질문에 답해야 해요. 무엇이 언어로 인정되는가? 언어학자들은 오래전부터 "언어"와 "방언" 사이의 경계가 구조적인 것만큼이나 사회적이고 정치적인 것임을 알고 있었어요. *"언어란 육군과 해군을 가진 방언이다"*라는 유명한 경구는 이디시어 언어학자 Max Weinreich가 1945년에 널리 퍼뜨린 것이에요(그는 이를 자신의 강연 중 한 청중의 말로 돌렸어요). 우리는 이 질문을 피할 수 없으므로, 여기 우리의 답변과 그 근거를 제시해요.

---

## 수어는 언어예요. 그것으로 끝이에요.

수어는 자연어예요 — 완전한 문법, 어린이의 모국어 습득, 살아있는 언어 공동체를 갖추고 있어요. 이는 American Sign Language가 음성 언어와 같은 종류의 내부 구조를 가지고 있음을 William Stokoe가 1960년에 입증한 이래로 정립된 언어학이며, 그 이후 60년간의 연구(Klima & Bellugi 1979; Sandler & Lillo-Martin 2006)는 이 점을 더욱 깊이 다졌을 뿐이에요. ISO 639-3는 수어에 개별 언어 코드를 부여하고, Glottolog는 이를 음성 언어 어족과 함께 분류해요. 우리의 카탈로그에는 `modality: signed`으로 태그된 160개 이상의 수어가 포함되어 있어요.

일부는 위기에 처한 토착 언어예요. Plains Indian Sign Language(`psd`)는 역사적으로 북미 전역에서 주요한 부족 간 공용어였으나, 오늘날에는 심각한 소멸 위기에 처해 있어요(Davis 2010, *Hand Talk*). 수어의 소멸은 *곧* 토착 언어의 소멸이며, 이는 이 프로젝트의 사명 안에 있어요.

**솔직한 범위 설명.** Network는 현재 *텍스트 기반* 기계 번역을 벤치마킹해요. 수어 기계 번역 — 영상, 공간 문법, 그리고 널리 채택된 문자 형태가 없는 언어를 다루는 것 — 은 다르고 대체로 미해결인 기술적 문제예요(Yin et al. 2021, "Including Signed Languages in Natural Language Processing," ACL 참조). 우리는 아직 이를 지원하지 않아요. 우리 카탈로그의 수어 항목은 정확히 그것을 말해요. **아직 지원되지 않음 — 결코 "언어가 아님"이 아니에요.**

## 양태는 두 가지가 있어요. 문자는 그중 하나가 아니에요.

언어는 두 가지 주요 양태로 존재해요. **음성**과 **수화**예요. 문자는 세 번째 양태가 아니에요 — 그것은 언어 위에 얹힌 기술이며, 세계 대부분의 언어는 표준화된 문자 없이도 잘 지내요. 그래서 우리의 언어 카드는 문자를 별도로 추적하고(어떤 언어가 어떤 문자를 사용하는지, 또는 표준화된 정서법이 전혀 없는지) 정직하게 추적해요. 텍스트 기반 기계 번역 플랫폼에서 언어가 문자화되어 있는지 여부는 각주가 아니라 핵심 정보이며 — 문자가 없는 언어가 열등한 언어인 것은 아니에요.

## 인공어는 포함, 프로그래밍 언어는 제외예요.

우리는 ISO 639-3 자체의 기준을 따라요. 이 표준은 인공어가 완전한 언어이고, 인간의 의사소통을 위해 설계되었으며, 문헌과 이를 2세대 사용자에게 전수한 공동체를 갖춘 경우에만 인정하며 — 컴퓨터 프로그래밍 언어는 명시적으로 제외해요. 모국어 화자를 가진 Esperanto는 자격을 갖추지만, 누구도 부모로부터 Python을 모국어로 습득하지 않으므로 Python은 자격을 갖추지 못해요. 우리 카탈로그에는 ISO가 인정하는 24개가량의 인공어가 그런 유형으로 포함되어 있으며, 프로그래밍 언어는 포함되지 않아요.

## 우리는 우산 분류가 아닌 개별 언어를 벤치마킹해요

ISO 639-3는 *개별 언어*와 *macrolanguage*를 구분해요 — `cre`(Cree), `ara`(Arabic), `zho`(Chinese)처럼 밀접하게 관련된 여러 개별 언어를 포괄하는 우산 코드예요. Network의 벤치마크 단위는 운영적 이유에서 **개별 언어**예요. 번역 자원은 변종에 특화되어 있기 때문이에요. Plains Cree(`crk`)용으로 구축된 형태소 분석기는 Moose Cree(`crm`)를 생성하지 않으며, Egyptian Arabic 말뭉치는 어떤 방법의 Moroccan Arabic에서의 품질에 대해 거의 알려주지 않아요. 우산 코드에 부여된 점수는 실제로 평가된 적이 없는 변종에 대한 주장이 될 것이므로 — 우리는 그렇게 하지 않아요.

Macrolanguage는 여전히 카탈로그에 **허브 페이지**로 나타나요. 우산 정체성을 그 개별 구성원에 연결하는 내비게이션으로, 두 수준의 정체성이 모두 실재한다는 ISO 자체의 관찰을 반영해요. 개별 언어 아래에는 Glottolog의 languoid 트리(Hammarström & Forkel 2022)에서 가져온 방언 및 계통 정보를 표시하는데, 이는 어족, 언어, 방언을 하나의 탐색 가능한 계층으로 모델링해요.

**포괄적인 코드(umbrella code)로 라벨링되어 들어오는 말뭉치(corpora)는 어떻게 할까요?** 실제 데이터 중 상당수가 그래요. "Quechua", "Persian" 또는 "Chinese (Simplified)"로 게시된 데이터셋들이 그 예시예요. 저희는 업스트림 라벨을 무조건 따르거나 버려야 할 진리가 아니라, *해결해야 할 메타데이터(metadata to resolve)*로 취급해요. 기계적인 사례는 공식 ISO 테이블을 통해 자동으로 해결돼요. 스크립트 태그는 제거되고(`cmn-Hans`은 간체자로 작성된 관화(Mandarin Chinese)를 의미하며, 스크립트는 기록되고 언어 식별자는 `cmn`이 돼요), 폐기된 코드는 공식 후속 코드를 따르게 돼요. 퍼블리셔가 자신의 데이터가 실제로 어떤 변종(variety)인지 문서화한 경우(예: FLORES+는 Quechua 기록을 `quy`, 즉 Ayacucho Quechua로 코딩해요), 저희는 말뭉치의 레지스트리 항목에 *인용(citation)과 함께* 해당 해결 결과를 기록하고, 말뭉치는 실제 개별 언어 하에서 벤치마크돼요. 그리고 컬렉션에 어떤 변종이 포함되어 있는지 아무도 알 수 없는 경우(일부 커뮤니티 문장 컬렉션은 의도적으로 포괄적인 "Arabic" 버킷을 유지하기도 해요), 저희는 임의로 추측하지 않아요. 말뭉치는 자체 라벨로 카탈로그에 유지되고, 대기열의 메타데이터에서 확인할 수 있는 기계 판독 가능한(machine-readable) 이유와 함께 작업 대기열에서 제외되며, 해당 말뭉치의 모든 과거 점수는 정직하게 라벨링된 포괄적 노드(umbrella node)에 계속 연결돼요. 평가된 적 없는 변종의 점수로 몰래 인정되는 일은 결코 없어요. 모든 해결 과정은 다시 도출할 수 있어요. 고정된 ISO 테이블, 말뭉치별 해결 스탬프, 인용 자료가 모두 공개 레지스트리에 함께 제공되거든요.

## 권위 있는 출처들이 의견이 갈릴 때는, 우리는 양쪽을 모두 보여줘요

ISO 639-3와 Glottolog는 때때로 다르게 나누거나 묶으며, 공동체는 때로 양쪽 모두와 의견이 다르기도 해요. 우리는 판결하지 않아요. 언어 카드는 출처와 함께 그 불일치를 표시하는 *분류 메모* 기능을 제공하며, 명명은 공동체가 선호를 표명한 경우 언제나 공동체를 따라요. 어떤 변종이 "언어"인지 여부는 결국 부분적으로 정체성의 문제이며 — 정체성 문제는 공동체 자체에 속하는데, 이는 토착 데이터 거버넌스 프레임워크에서 우리가 채택한 원칙이에요.

## 연구 방향: 측정 도구로서의 벤치마크

이와 같은 경연장이 거의 부산물로서 생산하는 한 가지는, 언어 변종들이 *운영적으로* 실제로 얼마나 가까운지에 대한 새로운 종류의 증거예요. 단일 번역 방법을 고정한 채로 여러 관련 변종에 배포 가능한 품질로 기능한다면, 그 변종들은 실제로 군집을 이루는 것이고, 별도의 말뭉치와 별도의 방법을 요구한다면 그것들은 — 명명 정치가 무엇이라 말하든 — 운영적으로 구별되는 것이에요. 이는 녹음 텍스트 이해도 검사부터 자동화된 어휘 거리 측정에 이르는 오래된 경험적 전통과 닮았는데, 배포에 기반한 변형을 가미한 것이에요.

우리는 이것을 주장이 아니라 연구 방향으로서 신중하게 제시해요. 방법 전이 결과는 말뭉치 크기, 도메인, 정서법, 학습 데이터 오염에 의해 교란되며, 군집화는 언제나 특정 방법과 품질 임계값에 상대적이에요. 무엇보다도, 이 신호는 언어와 방언에 관한 대화에 *정보를 줄* 수 있지만, 공동체가 자신의 언어를 어떻게 정체화하는지를 결코 뒤엎지 않아요.

---

## 참고문헌

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, eds. (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). "Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information." *Semantic Web* 13(6).
- Haugen, Einar (1966). "Dialect, Language, Nation." *American Anthropologist* 68(4).
- ISO 639-3 Registration Authority. "Scope of denotation" and "Types of individual languages." https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). "Der YIVO un di problemen fun undzer tsayt." *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). "Including Signed Languages in Natural Language Processing." *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/

---

## 이 사이트에서 이어지는 내용

이곳의 집계 규칙은 이 사이트의 모든 수치에 적용돼요.
[커버리지 방법론](/docs/network/context/coverage-counting)은
이 규칙을 기계 번역(MT) 서비스에 적용하고,
[언어 카드](/docs/reference/language-card-spec)는 각 출처가
실제로 주장하는 바를 언어별로 기록해요.
