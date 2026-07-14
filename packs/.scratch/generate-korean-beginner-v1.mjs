import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const packPath = path.join(root, "packs/korean-beginner-v1.json");
const curriculumPath = path.join(root, "packs/.curriculum-korean.json");
const validator = path.join(root, "packs/.scratch/validate-fydor-pack.mjs");
const now = "2026-07-14T00:00:00.000Z";

const v = (surface, lemma, meaning, role, explanation) => ({ surface, lemma, meaning, role, explanation });
const idiom = (surface, meaning, explanation) => ({ surface, meaning, explanation });
const line = (text, translation, grammarSurface) => ({ text, translation, grammarSurface });

function lesson(n, level, title, situation, grammarPoints, vocab, idioms, recycle, sentences) {
  return { n, level, title, situation, grammarPoints, vocab, idioms, recycle, sentences };
}

const lessons = [
  lesson(1, "A0", "Hello at the Guesthouse", "Two new learners meet at a Seoul guesthouse.", ["Fixed polite greetings", "저는 ...이에요/예요 for self-introduction"], [
    v("안녕하세요", "안녕하세요", "hello", "interjection"), v("저", "저", "I, me (polite)", "pronoun"), v("민지", "민지", "Minji", "name"), v("리암", "리암", "Liam", "name"), v("씨", "씨", "Mr./Ms. name suffix", "bound noun"), v("학생", "학생", "student", "noun"), v("영국", "영국", "the UK", "noun"), v("한국", "한국", "Korea", "noun"), v("사람", "사람", "person", "noun"), v("반가워요", "반갑다", "nice to meet you", "adjective"), v("네", "네", "yes; I hear you", "interjection"), v("아", "아", "oh", "interjection"), v("처음", "처음", "first time", "noun"), v("오늘", "오늘", "today", "noun"), v("여기", "여기", "here", "pronoun")
  ], [], [], [
    line("안녕하세요. 저는 민지예요.", "Hello. I'm Minji.", "저는 민지예요"),
    line("아, 안녕하세요. 저는 리암이에요.", "Oh, hello. I'm Liam.", "저는 리암이에요"),
    line("민지 씨는 학생이에요?", "Minji, are you a student?", "학생이에요"),
    line("네, 저는 학생이에요. 리암 씨도 학생이에요?", "Yes, I'm a student. Are you a student too?", "저는 학생이에요"),
    line("아니요, 저는 회사원이에요.", "No, I'm an office worker.", "저는 회사원이에요"),
    line("리암 씨는 영국 사람이에요?", "Liam, are you British?", "영국 사람이에요"),
    line("네, 영국 사람이에요. 민지 씨는 한국 사람이에요?", "Yes, I'm British. Minji, are you Korean?", "한국 사람이에요"),
    line("네, 맞아요. 한국 사람이에요.", "Yes, that's right. I'm Korean.", "한국 사람이에요"),
    line("오늘 여기 처음이에요.", "It's my first time here today.", "처음이에요"),
    line("저도요. 반가워요!", "Me too. Nice to meet you!", "반가워요")
  ]),
  lesson(2, "A0", "Names and Countries", "A small language class checks names, countries, and occupations.", ["은/는 topic marker", "이에요/예요 after consonant/vowel"], [
    v("이름", "이름", "name", "noun"), v("뭐", "뭐", "what", "pronoun"), v("미국", "미국", "the US", "noun"), v("일본", "일본", "Japan", "noun"), v("중국", "중국", "China", "noun"), v("프랑스", "프랑스", "France", "noun"), v("나라", "나라", "country", "noun"), v("친구", "친구", "friend", "noun"), v("선생님", "선생님", "teacher", "noun"), v("회사원", "회사원", "office worker", "noun"), v("가수", "가수", "singer", "noun"), v("배우", "배우", "actor", "noun"), v("맞아요", "맞다", "that's right", "adjective"), v("아니요", "아니요", "no", "interjection"), v("도", "도", "also, too", "particle")
  ], [], [1], [
    line("제 이름은 리암이에요.", "My name is Liam.", "이름은 리암이에요"),
    line("민지 씨 이름은 뭐예요?", "Minji, what's your name?", "뭐예요"),
    line("제 이름은 민지예요.", "My name is Minji.", "이름은 민지예요"),
    line("리암 씨는 미국 사람이에요?", "Liam, are you American?", "미국 사람이에요"),
    line("아니요, 저는 영국 사람이에요.", "No, I'm British.", "저는 영국 사람이에요"),
    line("이 친구는 일본 사람이에요.", "This friend is Japanese.", "일본 사람이에요"),
    line("선생님은 한국 사람이에요.", "The teacher is Korean.", "선생님은 한국 사람이에요"),
    line("프랑스 사람도 있어요?", "Is there a French person too?", "프랑스 사람도"),
    line("네, 저 친구가 프랑스 사람이에요.", "Yes, that friend is French.", "프랑스 사람이에요"),
    line("아, 맞아요. 저는 학생이고 친구는 회사원이에요.", "Oh, right. I'm a student and my friend is an office worker.", "친구는 회사원이에요")
  ]),
  lesson(3, "A0", "This, That, and Yes or No", "Learners point at objects on the classroom table.", ["이/그/저 demonstratives", "이것/그것/저것 + 이에요/예요"], [
    v("이것", "이것", "this thing", "pronoun"), v("그것", "그것", "that thing near you", "pronoun"), v("저것", "저것", "that thing over there", "pronoun"), v("책", "책", "book", "noun"), v("공책", "공책", "notebook", "noun"), v("펜", "펜", "pen", "noun"), v("가방", "가방", "bag", "noun"), v("휴대폰", "휴대폰", "mobile phone", "noun"), v("컴퓨터", "컴퓨터", "computer", "noun"), v("물", "물", "water", "noun"), v("커피", "커피", "coffee", "noun"), v("아니에요", "아니다", "is not", "adjective"), v("이거", "이거", "this one (spoken)", "pronoun"), v("그거", "그거", "that one (spoken)", "pronoun"), v("저기", "저기", "over there", "pronoun")
  ], [], [1, 2], [
    line("이것은 책이에요.", "This is a book.", "이것은 책이에요"),
    line("그것은 공책이에요?", "Is that a notebook?", "그것은 공책이에요"),
    line("네, 공책이에요. 이 펜도 제 펜이에요.", "Yes, it's a notebook. This pen is my pen too.", "이 펜"),
    line("저것은 가방이에요?", "Is that over there a bag?", "저것은 가방이에요"),
    line("아니요, 가방이 아니에요. 컴퓨터예요.", "No, it isn't a bag. It's a computer.", "아니에요"),
    line("이 휴대폰은 리암 씨 휴대폰이에요?", "Is this phone Liam's phone?", "이 휴대폰은"),
    line("네, 제 휴대폰이에요.", "Yes, it's my phone.", "제 휴대폰이에요"),
    line("그 물은 민지 씨 물이에요?", "Is that water Minji's?", "그 물은"),
    line("아니요, 커피예요. 물은 여기 있어요.", "No, it's coffee. The water is here.", "물은 여기 있어요"),
    line("아, 이제 알겠어요.", "Oh, now I get it.", "알겠어요")
  ]),
  lesson(4, "A0", "Where Is It?", "A student looks for things before class starts.", ["N에 있어요 for location", "없어요 for absence"], [
    v("어디", "어디", "where", "pronoun"), v("있어요", "있다", "is; exists; has", "verb"), v("없어요", "없다", "is not; does not exist", "verb"), v("교실", "교실", "classroom", "noun"), v("책상", "책상", "desk", "noun"), v("의자", "의자", "chair", "noun"), v("문", "문", "door", "noun"), v("창문", "창문", "window", "noun"), v("앞", "앞", "front", "noun"), v("뒤", "뒤", "back; behind", "noun"), v("옆", "옆", "side; beside", "noun"), v("위", "위", "top; above", "noun"), v("아래", "아래", "below", "noun"), v("안", "안", "inside", "noun"), v("밖", "밖", "outside", "noun")
  ], [], [1, 3], [
    line("제 가방이 어디에 있어요?", "Where is my bag?", "어디에 있어요"),
    line("가방은 책상 위에 있어요.", "The bag is on the desk.", "책상 위에 있어요"),
    line("공책은 가방 안에 있어요?", "Is the notebook in the bag?", "가방 안에 있어요"),
    line("아니요, 공책은 가방 안에 없어요.", "No, the notebook isn't in the bag.", "없어요"),
    line("펜은 의자 아래에 있어요.", "The pen is under the chair.", "의자 아래에 있어요"),
    line("선생님은 교실 앞에 있어요.", "The teacher is at the front of the classroom.", "교실 앞에 있어요"),
    line("휴대폰은 창문 옆에 있어요.", "The phone is beside the window.", "창문 옆에 있어요"),
    line("문 뒤에 책이 있어요?", "Is there a book behind the door?", "문 뒤에"),
    line("네, 책이 하나 있어요.", "Yes, there's one book.", "있어요"),
    line("커피는 밖에 있어요. 잠깐 나가요.", "The coffee is outside. Let's step out for a moment.", "밖에 있어요")
  ]),
  lesson(5, "A0", "Simple Classroom Actions", "A teacher gives slow classroom instructions.", ["Present polite -아요/-어요", "Verb stem + 요 in polite speech"], [
    v("가요", "가다", "go", "verb"), v("와요", "오다", "come", "verb"), v("봐요", "보다", "look; see", "verb"), v("읽어요", "읽다", "read", "verb"), v("들어요", "듣다", "listen; hear", "verb"), v("말해요", "말하다", "speak; say", "verb"), v("써요", "쓰다", "write; use", "verb"), v("앉아요", "앉다", "sit", "verb"), v("일어나요", "일어나다", "stand up; get up", "verb"), v("열어요", "열다", "open", "verb"), v("닫아요", "닫다", "close", "verb"), v("천천히", "천천히", "slowly", "adverb"), v("다시", "다시", "again", "adverb"), v("같이", "같이", "together", "adverb"), v("조금", "조금", "a little", "adverb")
  ], [], [1, 4], [
    line("선생님, 천천히 말해요.", "Teacher, please speak slowly.", "말해요"),
    line("네, 다시 말해요. 안녕하세요.", "Sure, I'll say it again. Hello.", "말해요"),
    line("여기 봐요. 이 책을 읽어요.", "Look here. Read this book.", "읽어요"),
    line("저는 듣고 있어요. 조금 어려워요.", "I'm listening. It's a little hard.", "듣고 있어요"),
    line("공책에 이름을 써요.", "Write your name in the notebook.", "써요"),
    line("문을 열어요. 교실이 조금 더워요.", "Open the door. The classroom is a little warm.", "열어요"),
    line("창문은 닫아요. 밖이 시끄러워요.", "Close the window. Outside is noisy.", "닫아요"),
    line("같이 읽어요. 하나, 둘, 셋.", "Let's read together. One, two, three.", "같이 읽어요"),
    line("리암 씨, 여기 와요. 민지 씨는 거기 앉아요.", "Liam, come here. Minji, sit there.", "와요"),
    line("수업 끝이에요. 이제 가요.", "Class is over. Let's go now.", "가요")
  ]),
  lesson(6, "A0", "Native Numbers at the Table", "Friends count small items and people at a study table.", ["Native Korean numbers 1-10", "Counting people with 명"], [
    v("하나", "하나", "one", "number"), v("둘", "둘", "two", "number"), v("셋", "셋", "three", "number"), v("넷", "넷", "four", "number"), v("다섯", "다섯", "five", "number"), v("여섯", "여섯", "six", "number"), v("일곱", "일곱", "seven", "number"), v("여덟", "여덟", "eight", "number"), v("아홉", "아홉", "nine", "number"), v("열", "열", "ten", "number"), v("명", "명", "people counter", "counter"), v("개", "개", "general object counter", "counter"), v("몇", "몇", "how many", "determiner"), v("사과", "사과", "apple", "noun"), v("잔", "잔", "cup counter", "counter")
  ], [], [3, 5], [
    line("사과가 몇 개 있어요?", "How many apples are there?", "몇 개"),
    line("사과가 하나, 둘, 셋 있어요.", "There are one, two, three apples.", "셋 있어요"),
    line("커피는 몇 잔이에요?", "How many cups of coffee is it?", "몇 잔"),
    line("커피 두 잔이에요.", "It's two coffees.", "두 잔"),
    line("학생은 몇 명이에요?", "How many students are there?", "몇 명"),
    line("학생은 네 명이에요. 선생님은 한 명이에요.", "There are four students. There is one teacher.", "네 명"),
    line("펜 다섯 개가 책상 위에 있어요.", "Five pens are on the desk.", "다섯 개"),
    line("공책 여섯 개도 있어요.", "There are six notebooks too.", "여섯 개"),
    line("아, 의자는 일곱 개예요.", "Oh, there are seven chairs.", "일곱 개예요"),
    line("가방은 여덟 개가 아니에요. 열 개예요.", "There aren't eight bags. There are ten.", "열 개예요")
  ]),
  lesson(7, "A0", "Phone Numbers and Prices", "A learner exchanges phone numbers and buys a cheap notebook.", ["Sino-Korean numbers", "N원이에요 for prices"], [
    v("영", "영", "zero", "number"), v("일", "일", "one", "number"), v("이", "이", "two", "number"), v("삼", "삼", "three", "number"), v("사", "사", "four", "number"), v("오", "오", "five", "number"), v("육", "육", "six", "number"), v("칠", "칠", "seven", "number"), v("팔", "팔", "eight", "number"), v("구", "구", "nine", "number"), v("십", "십", "ten", "number"), v("백", "백", "hundred", "number"), v("천", "천", "thousand", "number"), v("원", "원", "won, Korean currency", "noun"), v("번호", "번호", "number", "noun")
  ], [], [2, 6], [
    line("휴대폰 번호가 뭐예요?", "What's your mobile number?", "번호가 뭐예요"),
    line("공일공-이삼사오-육칠팔구예요.", "It's 010-2345-6789.", "예요"),
    line("아, 다시 말해 주세요.", "Oh, please say it again.", "주세요"),
    line("공일공, 이삼사오, 육칠팔구요.", "010, 2345, 6789.", "요"),
    line("이 공책은 얼마예요?", "How much is this notebook?", "얼마예요"),
    line("천 원이에요.", "It's one thousand won.", "원이에요"),
    line("펜은 오백 원이에요.", "The pen is five hundred won.", "원이에요"),
    line("책은 만 원이에요?", "Is the book ten thousand won?", "원이에요"),
    line("아니요, 팔천 원이에요.", "No, it's eight thousand won.", "원이에요"),
    line("좋아요. 공책 하나하고 펜 하나 주세요.", "Good. One notebook and one pen, please.", "주세요")
  ]),
  lesson(8, "A0", "Days and Time", "Two classmates coordinate class times.", ["Time words with 에", "몇 시예요?"], [
    v("지금", "지금", "now", "noun"), v("시", "시", "o'clock", "counter"), v("분", "분", "minute", "counter"), v("아침", "아침", "morning", "noun"), v("점심", "점심", "lunch; noon", "noun"), v("저녁", "저녁", "evening; dinner", "noun"), v("월요일", "월요일", "Monday", "noun"), v("화요일", "화요일", "Tuesday", "noun"), v("수요일", "수요일", "Wednesday", "noun"), v("목요일", "목요일", "Thursday", "noun"), v("금요일", "금요일", "Friday", "noun"), v("토요일", "토요일", "Saturday", "noun"), v("일요일", "일요일", "Sunday", "noun"), v("오전", "오전", "a.m.", "noun"), v("오후", "오후", "p.m.", "noun")
  ], [], [5, 7], [
    line("지금 몇 시예요?", "What time is it now?", "몇 시예요"),
    line("지금 오전 아홉 시예요.", "It's nine a.m. now.", "오전 아홉 시예요"),
    line("수업은 몇 시에 시작해요?", "What time does class start?", "몇 시에"),
    line("오전 열 시에 시작해요.", "It starts at ten a.m.", "열 시에"),
    line("점심은 열두 시에 먹어요.", "We eat lunch at twelve.", "열두 시에"),
    line("오늘은 월요일이에요.", "Today is Monday.", "월요일이에요"),
    line("화요일에도 수업이 있어요?", "Is there class on Tuesday too?", "화요일에도"),
    line("네, 화요일하고 목요일에 있어요.", "Yes, it's on Tuesday and Thursday.", "목요일에"),
    line("금요일 저녁에는 뭐 해요?", "What do you do Friday evening?", "금요일 저녁에는"),
    line("음, 오후 일곱 시에 친구를 만나요.", "Hmm, I meet a friend at seven p.m.", "오후 일곱 시에")
  ]),
  lesson(9, "A0", "Family Photos", "A learner shows a phone photo of family members.", ["제/우리 possessives", "하고 for simple linking"], [
    v("가족", "가족", "family", "noun"), v("아버지", "아버지", "father", "noun"), v("어머니", "어머니", "mother", "noun"), v("형", "형", "older brother of a male", "noun"), v("오빠", "오빠", "older brother of a female", "noun"), v("누나", "누나", "older sister of a male", "noun"), v("언니", "언니", "older sister of a female", "noun"), v("동생", "동생", "younger sibling", "noun"), v("아들", "아들", "son", "noun"), v("딸", "딸", "daughter", "noun"), v("사진", "사진", "photo", "noun"), v("우리", "우리", "our; my", "pronoun"), v("제", "저의", "my (polite)", "determiner"), v("하고", "하고", "and; with", "particle"), v("귀여워요", "귀엽다", "cute", "adjective")
  ], [], [1, 8], [
    line("이 사진은 제 가족 사진이에요.", "This photo is my family photo.", "제 가족 사진이에요"),
    line("이분은 제 아버지예요.", "This person is my father.", "제 아버지예요"),
    line("옆에는 어머니가 있어요.", "My mother is beside him.", "어머니가 있어요"),
    line("형도 있어요?", "Do you have an older brother too?", "형도 있어요"),
    line("네, 형하고 동생이 있어요.", "Yes, I have an older brother and a younger sibling.", "형하고 동생"),
    line("민지 씨는 오빠가 있어요?", "Minji, do you have an older brother?", "오빠가 있어요"),
    line("아니요, 언니 한 명이 있어요.", "No, I have one older sister.", "언니 한 명"),
    line("우리 언니는 회사원이에요.", "My older sister is an office worker.", "우리 언니는"),
    line("이 아이는 조카예요. 정말 귀여워요.", "This child is my niece/nephew. So cute.", "귀여워요"),
    line("가족이 많네요.", "You have a big family.", "가족이")
  ]),
  lesson(10, "A0", "Food Likes", "Two classmates choose a simple lunch.", ["Object marker 을/를", "좋아해요/안 좋아해요"], [
    v("밥", "밥", "rice; meal", "noun"), v("김치", "김치", "kimchi", "noun"), v("라면", "라면", "ramyeon", "noun"), v("불고기", "불고기", "bulgogi", "noun"), v("비빔밥", "비빔밥", "bibimbap", "noun"), v("빵", "빵", "bread", "noun"), v("우유", "우유", "milk", "noun"), v("차", "차", "tea", "noun"), v("주스", "주스", "juice", "noun"), v("음식", "음식", "food", "noun"), v("맛", "맛", "taste", "noun"), v("좋아해요", "좋아하다", "like", "verb"), v("먹어요", "먹다", "eat", "verb"), v("마셔요", "마시다", "drink", "verb"), v("맛있어요", "맛있다", "tastes good", "adjective")
  ], [], [7, 8], [
    line("민지 씨는 김치를 좋아해요?", "Minji, do you like kimchi?", "김치를 좋아해요"),
    line("네, 김치를 좋아해요. 리암 씨는요?", "Yes, I like kimchi. How about you, Liam?", "좋아해요"),
    line("저는 라면을 좋아해요.", "I like ramyeon.", "라면을 좋아해요"),
    line("불고기도 좋아해요?", "Do you like bulgogi too?", "불고기도"),
    line("네, 불고기는 정말 맛있어요.", "Yes, bulgogi is really good.", "맛있어요"),
    line("점심에 비빔밥을 먹어요?", "Shall we eat bibimbap for lunch?", "비빔밥을 먹어요"),
    line("좋아요. 저는 물을 마셔요.", "Sounds good. I'll drink water.", "마셔요"),
    line("저는 차하고 주스를 안 좋아해요.", "I don't like tea or juice.", "안 좋아해요"),
    line("아침에는 빵하고 우유를 먹어요.", "In the morning I have bread and milk.", "우유를 먹어요"),
    line("한국 음식 맛이 좋아요.", "Korean food tastes good.", "맛이 좋아요")
  ]),
  lesson(11, "A0", "At a Cafe Counter", "A learner orders drinks politely at a cafe.", ["N 주세요 for requests", "하고 for ordering multiple items"], [
    v("카페", "카페", "cafe", "noun"), v("메뉴", "메뉴", "menu", "noun"), v("아메리카노", "아메리카노", "americano", "noun"), v("라떼", "라떼", "latte", "noun"), v("아이스", "아이스", "iced", "noun"), v("따뜻한", "따뜻하다", "warm", "adjective"), v("설탕", "설탕", "sugar", "noun"), v("컵", "컵", "cup", "noun"), v("빨대", "빨대", "straw", "noun"), v("주세요", "주다", "please give me", "verb"), v("계산", "계산", "payment; calculation", "noun"), v("카드", "카드", "card", "noun"), v("현금", "현금", "cash", "noun"), v("여기요", "여기요", "excuse me; over here", "interjection"), v("감사합니다", "감사하다", "thank you", "verb")
  ], [], [7, 10], [
    line("여기요, 메뉴 주세요.", "Excuse me, the menu please.", "주세요"),
    line("아이스 아메리카노 하나 주세요.", "One iced americano, please.", "주세요"),
    line("저는 따뜻한 라떼 주세요.", "I'll have a warm latte, please.", "주세요"),
    line("설탕은 넣어요?", "Do you put in sugar?", "넣어요"),
    line("아니요, 설탕은 안 넣어요.", "No, I don't put in sugar.", "안 넣어요"),
    line("컵하고 빨대도 주세요.", "A cup and straw too, please.", "주세요"),
    line("계산은 카드로 해요?", "Will you pay by card?", "카드로"),
    line("네, 카드로 계산해요.", "Yes, I'll pay by card.", "계산해요"),
    line("현금도 돼요?", "Is cash okay too?", "돼요"),
    line("네, 감사합니다. 맛있게 드세요.", "Yes, thank you. Enjoy.", "감사합니다")
  ]),
  lesson(12, "A0", "Daily Routine", "A learner describes an ordinary weekday.", ["Time + 에 action", "매일/자주 frequency adverbs"], [
    v("매일", "매일", "every day", "adverb"), v("자주", "자주", "often", "adverb"), v("가끔", "가끔", "sometimes", "adverb"), v("기상해요", "기상하다", "get up; rise", "verb"), v("씻어요", "씻다", "wash", "verb"), v("공부해요", "공부하다", "study", "verb"), v("일해요", "일하다", "work", "verb"), v("운동해요", "운동하다", "exercise", "verb"), v("쉬어요", "쉬다", "rest", "verb"), v("자요", "자다", "sleep", "verb"), v("집", "집", "home; house", "noun"), v("학교", "학교", "school", "noun"), v("회사", "회사", "company; workplace", "noun"), v("버스", "버스", "bus", "noun"), v("밤", "밤", "night", "noun")
  ], [], [8, 10], [
    line("저는 매일 아침 일곱 시에 일어나요.", "I get up at seven every morning.", "일곱 시에"),
    line("그리고 씻어요.", "And then I wash up.", "씻어요"),
    line("아침에 빵하고 우유를 먹어요.", "In the morning I have bread and milk.", "아침에"),
    line("여덟 시에 버스를 타요.", "I take the bus at eight.", "여덟 시에"),
    line("학교에서 한국어를 공부해요.", "I study Korean at school.", "학교에서"),
    line("민지 씨는 회사에서 일해요.", "Minji works at a company.", "회사에서"),
    line("저녁에는 가끔 운동해요.", "In the evening I sometimes exercise.", "가끔 운동해요"),
    line("밤에는 집에서 쉬어요.", "At night I rest at home.", "집에서 쉬어요"),
    line("커피는 자주 마셔요?", "Do you drink coffee often?", "자주 마셔요"),
    line("네, 하지만 밤에는 안 마셔요. 늦게 자요.", "Yes, but I don't drink it at night. I sleep late.", "안 마셔요")
  ]),
  lesson(13, "A0", "Weather Check", "Friends decide what to wear before going out.", ["Descriptive verbs in -아요/-어요", "오늘 날씨가 ..."], [
    v("날씨", "날씨", "weather", "noun"), v("좋아요", "좋다", "is good", "adjective"), v("나빠요", "나쁘다", "is bad", "adjective"), v("추워요", "춥다", "is cold", "adjective", "ㅂ irregular: 춥다 becomes 추워요."), v("더워요", "덥다", "is hot", "adjective", "ㅂ irregular: 덥다 becomes 더워요."), v("시원해요", "시원하다", "is cool; refreshing", "adjective"), v("따뜻해요", "따뜻하다", "is warm", "adjective"), v("비", "비", "rain", "noun"), v("눈", "눈", "snow", "noun"), v("바람", "바람", "wind", "noun"), v("많아요", "많다", "is many; a lot", "adjective"), v("우산", "우산", "umbrella", "noun"), v("옷", "옷", "clothes", "noun"), v("입어요", "입다", "wear", "verb"), v("필요해요", "필요하다", "need; is necessary", "adjective")
  ], [], [4, 12], [
    line("오늘 날씨가 어때요?", "How's the weather today?", "어때요"),
    line("오늘은 날씨가 좋아요.", "The weather is good today.", "날씨가 좋아요"),
    line("아침에는 조금 추워요.", "It's a little cold in the morning.", "추워요"),
    line("점심에는 따뜻해요.", "It's warm at lunch.", "따뜻해요"),
    line("여름에는 정말 더워요.", "It's really hot in summer.", "더워요"),
    line("밖에 바람이 많아요.", "It's windy outside.", "바람이 많아요"),
    line("비가 와요. 우산이 필요해요.", "It's raining. We need an umbrella.", "비가 와요"),
    line("눈도 와요?", "Is it snowing too?", "눈도 와요"),
    line("아니요, 눈은 안 와요.", "No, it isn't snowing.", "안 와요"),
    line("그럼 따뜻한 옷을 입어요.", "Then wear warm clothes.", "옷을 입어요")
  ]),
  lesson(14, "A0", "Question Words", "A learner asks basic questions around campus.", ["Wh-questions with 뭐/어디/누구/언제", "Question intonation in polite speech"], [
    v("누구", "누구", "who", "pronoun"), v("언제", "언제", "when", "pronoun"), v("왜", "왜", "why", "adverb"), v("어떻게", "어떻게", "how", "adverb"), v("얼마", "얼마", "how much", "noun"), v("무슨", "무슨", "what kind of", "determiner"), v("어느", "어느", "which", "determiner"), v("카페테리아", "카페테리아", "cafeteria", "noun"), v("도서관", "도서관", "library", "noun"), v("화장실", "화장실", "bathroom", "noun"), v("수업", "수업", "class", "noun"), v("시작해요", "시작하다", "start", "verb"), v("끝나요", "끝나다", "end", "verb"), v("만나요", "만나다", "meet", "verb"), v("도와줘요", "도와주다", "help", "verb")
  ], [], [8, 12], [
    line("화장실이 어디예요?", "Where is the bathroom?", "어디예요"),
    line("저기 문 옆에 있어요.", "It's over there beside the door.", "옆에 있어요"),
    line("수업은 언제 시작해요?", "When does class start?", "언제 시작해요"),
    line("오전 열 시에 시작해요.", "It starts at ten a.m.", "시작해요"),
    line("수업은 언제 끝나요?", "When does class end?", "언제 끝나요"),
    line("열한 시 반에 끝나요.", "It ends at eleven thirty.", "끝나요"),
    line("누구를 만나요?", "Who are you meeting?", "누구를 만나요"),
    line("도서관에서 친구를 만나요.", "I'm meeting a friend at the library.", "도서관에서"),
    line("무슨 음식을 좋아해요?", "What kind of food do you like?", "무슨 음식"),
    line("비빔밥을 좋아해요. 아, 좀 도와줘요.", "I like bibimbap. Oh, help me a bit.", "도와줘요")
  ]),
  lesson(15, "A0", "Shopping for Small Things", "A learner buys stationery and asks for quantities.", ["Counters with 개/권/병", "이/가 subject marker in existence sentences"], [
    v("가게", "가게", "shop", "noun"), v("시장", "시장", "market", "noun"), v("얼마예요", "얼마예요", "how much is it?", "phrase"), v("비싸요", "비싸다", "is expensive", "adjective"), v("싸요", "싸다", "is cheap", "adjective"), v("권", "권", "book counter", "counter"), v("병", "병", "bottle counter", "counter"), v("봉지", "봉지", "bag; packet", "noun"), v("봉투", "봉투", "shopping bag; envelope", "noun"), v("사요", "사다", "buy", "verb"), v("팔아요", "팔다", "sell", "verb"), v("깎아주세요", "깎아주다", "please discount it", "verb"), v("영수증", "영수증", "receipt", "noun"), v("필요 없어요", "필요 없다", "do not need", "phrase"), v("괜찮아요", "괜찮다", "is okay", "adjective")
  ], [], [7, 11], [
    line("이 가게에서 공책을 팔아요?", "Do they sell notebooks at this shop?", "팔아요"),
    line("네, 공책하고 펜을 팔아요.", "Yes, they sell notebooks and pens.", "팔아요"),
    line("공책 두 권 주세요.", "Two notebooks, please.", "두 권"),
    line("물 한 병도 주세요.", "One bottle of water too, please.", "한 병"),
    line("이 봉지는 얼마예요?", "How much is this bag?", "얼마예요"),
    line("천 원이에요. 비싸지 않아요.", "It's one thousand won. It's not expensive.", "비싸지 않아요"),
    line("조금 비싸요. 깎아주세요.", "It's a little expensive. Please give me a discount.", "깎아주세요"),
    line("죄송해요, 안 돼요.", "Sorry, I can't.", "안 돼요"),
    line("괜찮아요. 그럼 이거 사요.", "That's okay. Then I'll buy this.", "괜찮아요"),
    line("영수증 필요해요? 아니요, 필요 없어요.", "Do you need a receipt? No, I don't need one.", "필요 없어요")
  ]),
  lesson(16, "A0", "Around Town", "Friends ask where buildings are.", ["Place + 에 가요/와요", "에서 for action location"], [
    v("역", "역", "station", "noun"), v("은행", "은행", "bank", "noun"), v("병원", "병원", "hospital", "noun"), v("약국", "약국", "pharmacy", "noun"), v("우체국", "우체국", "post office", "noun"), v("공원", "공원", "park", "noun"), v("식당", "식당", "restaurant", "noun"), v("영화관", "영화관", "movie theater", "noun"), v("마트", "마트", "mart; grocery store", "noun"), v("길", "길", "road; way", "noun"), v("오른쪽", "오른쪽", "right side", "noun"), v("왼쪽", "왼쪽", "left side", "noun"), v("똑바로", "똑바로", "straight", "adverb"), v("돌아요", "돌다", "turn", "verb"), v("걸어요", "걷다", "walk", "verb")
  ], [], [4, 14], [
    line("역이 어디에 있어요?", "Where is the station?", "어디에 있어요"),
    line("똑바로 가요. 그리고 오른쪽으로 돌아요.", "Go straight. Then turn right.", "오른쪽으로 돌아요"),
    line("은행은 역 옆에 있어요.", "The bank is next to the station.", "역 옆에 있어요"),
    line("약국도 근처에 있어요?", "Is there a pharmacy nearby too?", "약국도"),
    line("네, 병원 앞에 약국이 있어요.", "Yes, there's a pharmacy in front of the hospital.", "병원 앞에"),
    line("저는 공원까지 걸어요.", "I'll walk to the park.", "걸어요"),
    line("식당은 왼쪽에 있어요.", "The restaurant is on the left.", "왼쪽에 있어요"),
    line("영화관은 어디예요?", "Where is the movie theater?", "어디예요"),
    line("마트 뒤에 있어요.", "It's behind the mart.", "뒤에 있어요"),
    line("아, 길이 조금 어려워요.", "Ah, the route is a little hard.", "길이")
  ]),
  lesson(17, "A0", "Transportation Choices", "A learner decides how to get to class.", ["(으)로 by means/direction", "타요 for riding transport"], [
    v("지하철", "지하철", "subway", "noun"), v("택시", "택시", "taxi", "noun"), v("자전거", "자전거", "bicycle", "noun"), v("걸어서", "걷다", "on foot; by walking", "adverb"), v("타요", "타다", "ride; take", "verb"), v("내려요", "내리다", "get off", "verb"), v("갈아타요", "갈아타다", "transfer", "verb"), v("정류장", "정류장", "bus stop", "noun"), v("출구", "출구", "exit", "noun"), v("가까워요", "가깝다", "is close", "adjective"), v("멀어요", "멀다", "is far", "adjective"), v("빠라요", "빠르다", "is fast", "adjective"), v("느려요", "느리다", "is slow", "adjective"), v("교통", "교통", "traffic; transportation", "noun"), v("복잡해요", "복잡하다", "is crowded; complicated", "adjective")
  ], [], [8, 16], [
    line("학교까지 뭐로 가요?", "How do you get to school?", "뭐로 가요"),
    line("저는 지하철로 가요.", "I go by subway.", "지하철로"),
    line("버스는 조금 느려요.", "The bus is a little slow.", "느려요"),
    line("택시는 빠르지만 비싸요.", "Taxis are fast but expensive.", "빠르지만"),
    line("집이 가까워요? 그럼 걸어서 가요.", "Is your home close? Then go on foot.", "걸어서"),
    line("정류장은 어디에 있어요?", "Where is the bus stop?", "정류장은"),
    line("은행 앞에서 버스를 타요.", "Take the bus in front of the bank.", "버스를 타요"),
    line("두 정거장 뒤에 내려요.", "Get off after two stops.", "내려요"),
    line("지하철은 한 번 갈아타요.", "Transfer once on the subway.", "갈아타요"),
    line("오늘은 교통이 복잡해요.", "Traffic is heavy today.", "교통이 복잡해요")
  ]),
  lesson(18, "A0", "Making Simple Plans", "Two friends make a low-pressure weekend plan.", ["-고 싶어요 want to", "같이 + verb"], [
    v("주말", "주말", "weekend", "noun"), v("계획", "계획", "plan", "noun"), v("영화", "영화", "movie", "noun"), v("음악", "음악", "music", "noun"), v("노래", "노래", "song", "noun"), v("춤", "춤", "dance", "noun"), v("여행", "여행", "travel; trip", "noun"), v("쉬고 싶어요", "쉬다", "want to rest", "phrase"), v("보고 싶어요", "보다", "want to see; miss", "phrase"), v("먹고 싶어요", "먹다", "want to eat", "phrase"), v("가고 싶어요", "가다", "want to go", "phrase"), v("하고 싶어요", "하다", "want to do", "phrase"), v("이번", "이번", "this; current", "determiner"), v("다음", "다음", "next", "noun"), v("무리 없어요", "무리 없다", "no problem; manageable", "phrase")
  ], [], [10, 16], [
    line("이번 주말에 뭐 하고 싶어요?", "What do you want to do this weekend?", "하고 싶어요"),
    line("저는 그냥 쉬고 싶어요.", "I just want to rest.", "쉬고 싶어요"),
    line("영화 보고 싶어요?", "Do you want to see a movie?", "보고 싶어요"),
    line("네, 한국 영화를 보고 싶어요.", "Yes, I want to see a Korean movie.", "보고 싶어요"),
    line("저는 비빔밥도 먹고 싶어요.", "I want to eat bibimbap too.", "먹고 싶어요"),
    line("그럼 같이 식당에 가요.", "Then let's go to a restaurant together.", "같이"),
    line("음악도 듣고 싶어요?", "Do you want to listen to music too?", "듣고 싶어요"),
    line("네, 하지만 춤은 안 추고 싶어요.", "Yes, but I don't want to dance.", "안 추고 싶어요"),
    line("다음 주에는 여행 가고 싶어요.", "Next week I want to travel.", "가고 싶어요"),
    line("좋아요. 계획이 괜찮아요.", "Good. The plan is fine.", "괜찮아요")
  ]),
  lesson(19, "A0", "Reviewing a Busy Day", "A learner gives a simple present-tense recap.", ["그리고/하지만 connectors", "Topic shifts with 은/는"], [
    v("바빠요", "바쁘다", "is busy", "adjective"), v("한가해요", "한가하다", "is free; not busy", "adjective"), v("피곤해요", "피곤하다", "is tired", "adjective"), v("재미있어요", "재미있다", "is interesting; fun", "adjective"), v("어려워요", "어렵다", "is difficult", "adjective"), v("쉬워요", "쉽다", "is easy", "adjective"), v("중요해요", "중요하다", "is important", "adjective"), v("괜찮네요", "괜찮다", "seems okay", "adjective"), v("너무", "너무", "too; very", "adverb"), v("정말", "정말", "really", "adverb"), v("그래도", "그래도", "still; even so", "adverb"), v("하지만", "하지만", "but", "conjunction"), v("그리고", "그리고", "and; and then", "conjunction"), v("그래서", "그래서", "so", "conjunction"), v("하루", "하루", "one day; day", "noun")
  ], [], [12, 18], [
    line("오늘 하루가 정말 바빠요.", "Today is really busy.", "하루가 정말 바빠요"),
    line("아침에는 수업이 있어요.", "In the morning I have class.", "아침에는"),
    line("그리고 점심에는 친구를 만나요.", "And at lunch I meet a friend.", "그리고"),
    line("오후에는 회사에서 일해요.", "In the afternoon I work at the office.", "오후에는"),
    line("한국어는 재미있어요. 하지만 조금 어려워요.", "Korean is fun. But it's a little hard.", "하지만"),
    line("이 문장은 쉬워요.", "This sentence is easy.", "쉬워요"),
    line("발음은 중요해요.", "Pronunciation is important.", "중요해요"),
    line("저녁에는 너무 피곤해요.", "In the evening I'm so tired.", "피곤해요"),
    line("그래도 운동하고 싶어요.", "Still, I want to exercise.", "그래도"),
    line("내일은 한가해요. 괜찮아요.", "Tomorrow I'm free. It's okay.", "괜찮아요")
  ]),
  lesson(20, "A0", "A0 Checkpoint: First Week in Seoul", "A learner uses early Korean to handle a first week.", ["Integrated A0 review", "Short polite dialogue turns"], [
    v("서울", "서울", "Seoul", "noun"), v("한국어", "한국어", "Korean language", "noun"), v("발음", "발음", "pronunciation", "noun"), v("문장", "문장", "sentence", "noun"), v("연습", "연습", "practice", "noun"), v("숙제", "숙제", "homework", "noun"), v("질문", "질문", "question", "noun"), v("대답", "대답", "answer", "noun"), v("알겠어요", "알겠다", "I understand; got it", "phrase"), v("몰라요", "모르다", "do not know", "verb"), v("배워요", "배우다", "learn", "verb"), v("연습해요", "연습하다", "practice", "verb"), v("물어봐요", "물어보다", "ask", "verb"), v("대답해요", "대답하다", "answer", "verb"), v("분명히", "분명히", "clearly", "adverb")
  ], [], [1, 5, 10, 18], [
    line("저는 서울에서 한국어를 배워요.", "I'm learning Korean in Seoul.", "한국어를 배워요"),
    line("처음에는 발음이 어려워요.", "At first, pronunciation is hard.", "발음이 어려워요"),
    line("그래도 매일 연습해요.", "Still, I practice every day.", "매일 연습해요"),
    line("선생님이 문장을 천천히 읽어요.", "The teacher reads the sentence slowly.", "천천히 읽어요"),
    line("저는 질문을 물어봐요.", "I ask a question.", "질문을 물어봐요"),
    line("친구가 대답해요.", "My friend answers.", "대답해요"),
    line("숙제가 많아요?", "Is there a lot of homework?", "많아요"),
    line("아니요, 숙제는 조금 있어요.", "No, there's a little homework.", "조금 있어요"),
    line("이제 조금 알겠어요.", "Now I understand a little.", "알겠어요"),
    line("몰라도 괜찮아요. 같이 배워요.", "It's okay if you don't know. Let's learn together.", "괜찮아요")
  ]),
  lesson(21, "A1", "Yesterday at the Cafe", "Friends talk about what they did yesterday.", ["Past tense -았어요/-었어요", "어제/지난 for past time"], [
    v("어제", "어제", "yesterday", "noun"), v("지난", "지난", "last; past", "determiner"), v("갔어요", "가다", "went", "verb"), v("왔어요", "오다", "came", "verb"), v("먹었어요", "먹다", "ate", "verb"), v("마셨어요", "마시다", "drank", "verb"), v("봤어요", "보다", "saw; watched", "verb"), v("샀어요", "사다", "bought", "verb"), v("만났어요", "만나다", "met", "verb"), v("했어요", "하다", "did", "verb"), v("이야기", "이야기", "story; talk", "noun"), v("오랜만", "오랜만", "a long time", "noun"), v("친절했어요", "친절하다", "was kind", "adjective"), v("조용했어요", "조용하다", "was quiet", "adjective"), v("시끄러웠어요", "시끄럽다", "was noisy", "adjective")
  ], [idiom("오랜만이에요", "Long time no see.", "Literally 'it is after a long time.' A very common greeting when you have not seen someone for a while.")], [10, 11, 18], [
    line("민지 씨, 오랜만이에요!", "Minji, long time no see!", "오랜만이에요"),
    line("네, 정말 오랜만이에요. 어제 뭐 했어요?", "Yes, it really has been a while. What did you do yesterday?", "뭐 했어요"),
    line("어제 카페에 갔어요.", "I went to a cafe yesterday.", "갔어요"),
    line("아이스 아메리카노를 마셨어요.", "I drank an iced americano.", "마셨어요"),
    line("친구도 만났어요.", "I met a friend too.", "만났어요"),
    line("카페가 조용했어요?", "Was the cafe quiet?", "조용했어요"),
    line("아니요, 조금 시끄러웠어요.", "No, it was a little noisy.", "시끄러웠어요"),
    line("그래도 직원이 친절했어요.", "Still, the staff was kind.", "친절했어요"),
    line("저는 공책하고 펜을 샀어요.", "I bought a notebook and a pen.", "샀어요"),
    line("좋았어요. 이야기도 많이 했어요.", "It was nice. We talked a lot too.", "했어요")
  ]),
  lesson(22, "A1", "I Can't Today", "A friend softly refuses a plan and explains why.", ["안 + verb/adjective negation", "못 + verb inability"], [
    v("못 가요", "못 가다", "can't go", "phrase"), v("못 먹어요", "못 먹다", "can't eat", "phrase"), v("안 해요", "안 하다", "do not do", "phrase"), v("안 좋아해요", "안 좋아하다", "do not like", "phrase"), v("아파요", "아프다", "hurt; be sick", "adjective"), v("머리", "머리", "head", "noun"), v("배", "배", "stomach", "noun"), v("약", "약", "medicine", "noun"), v("약속", "약속", "appointment; promise", "noun"), v("미안해요", "미안하다", "sorry", "adjective"), v("괜찮을 거예요", "괜찮다", "will be okay", "phrase"), v("먼저", "먼저", "first; ahead", "adverb"), v("나중에", "나중에", "later", "adverb"), v("푹", "푹", "deeply; well", "adverb"), v("쉬세요", "쉬다", "please rest", "verb")
  ], [idiom("몸이 안 좋아요", "I don't feel well.", "Literally 'my body is not good.' Natural spoken Korean for feeling sick or off; neutral plain form is 몸이 안 좋다.")], [13, 18, 21], [
    line("오늘 영화 보러 갈래요?", "Want to go see a movie today?", "갈래요"),
    line("미안해요, 오늘은 못 가요.", "Sorry, I can't go today.", "못 가요"),
    line("왜요? 약속이 있어요?", "Why? Do you have an appointment?", "약속이 있어요"),
    line("아니요, 몸이 안 좋아요.", "No, I don't feel well.", "몸이 안 좋아요"),
    line("머리가 조금 아파요.", "My head hurts a little.", "아파요"),
    line("배도 아파요. 그래서 라면을 못 먹어요.", "My stomach hurts too. So I can't eat ramyeon.", "못 먹어요"),
    line("아, 그럼 약을 먹어요.", "Oh, then take some medicine.", "약을 먹어요"),
    line("네, 먼저 집에 가요.", "Yes, I'll go home first.", "먼저"),
    line("나중에 다시 만나요.", "Let's meet again later.", "나중에"),
    line("괜찮아요. 오늘은 푹 쉬세요.", "It's okay. Rest well today.", "쉬세요")
  ]),
  lesson(23, "A1", "Tomorrow's Plan", "Friends discuss a near-future plan.", ["Future -(으)ㄹ 거예요", "내일/이번 주 future time"], [
    v("내일", "내일", "tomorrow", "noun"), v("모레", "모레", "the day after tomorrow", "noun"), v("다음 주", "다음 주", "next week", "noun"), v("갈 거예요", "가다", "will go", "phrase"), v("먹을 거예요", "먹다", "will eat", "phrase"), v("볼 거예요", "보다", "will see", "phrase"), v("살 거예요", "사다", "will buy", "phrase"), v("공부할 거예요", "공부하다", "will study", "phrase"), v("쉴 거예요", "쉬다", "will rest", "phrase"), v("비행기", "비행기", "airplane", "noun"), v("기차", "기차", "train", "noun"), v("표", "표", "ticket", "noun"), v("예약", "예약", "reservation", "noun"), v("아마", "아마", "probably", "adverb"), v("꼭", "꼭", "definitely; surely", "adverb")
  ], [idiom("꼭 갈게요", "I'll definitely go.", "꼭 means 'surely/without fail.' With -ㄹ게요 it sounds like a friendly promise based on the speaker's decision.")], [17, 18, 21], [
    line("내일 뭐 할 거예요?", "What will you do tomorrow?", "할 거예요"),
    line("아마 도서관에 갈 거예요.", "I'll probably go to the library.", "갈 거예요"),
    line("저는 한국어를 공부할 거예요.", "I'll study Korean.", "공부할 거예요"),
    line("점심에는 뭘 먹을 거예요?", "What will you eat for lunch?", "먹을 거예요"),
    line("비빔밥을 먹을 거예요.", "I'll eat bibimbap.", "먹을 거예요"),
    line("모레는 영화를 볼 거예요.", "The day after tomorrow I'll watch a movie.", "볼 거예요"),
    line("다음 주에는 기차표를 살 거예요.", "Next week I'll buy a train ticket.", "살 거예요"),
    line("예약도 할 거예요?", "Will you make a reservation too?", "예약"),
    line("네, 오늘 밤에 할 거예요.", "Yes, I'll do it tonight.", "할 거예요"),
    line("걱정 마세요. 저는 꼭 갈게요.", "Don't worry. I'll definitely go.", "꼭 갈게요")
  ]),
  lesson(24, "A1", "Because It's Raining", "A plan changes because of weather.", ["-아서/-어서 because/so", "Clause order cause before result"], [
    v("비가 와서", "비가 오다", "because it rains", "clause"), v("추워서", "춥다", "because it is cold", "clause"), v("더워서", "덥다", "because it is hot", "clause"), v("바빠서", "바쁘다", "because busy", "clause"), v("피곤해서", "피곤하다", "because tired", "clause"), v("늦어서", "늦다", "because late", "clause"), v("일찍", "일찍", "early", "adverb"), v("늦게", "늦게", "late", "adverb"), v("취소해요", "취소하다", "cancel", "verb"), v("바꿔요", "바꾸다", "change", "verb"), v("기다려요", "기다리다", "wait", "verb"), v("전화해요", "전화하다", "call by phone", "verb"), v("문자", "문자", "text message", "noun"), v("보내요", "보내다", "send", "verb"), v("우울해요", "우울하다", "feel down", "adjective")
  ], [idiom("다행이에요", "That's a relief.", "Literally 'it is fortunate.' Used when something turns out okay or a problem is avoided.")], [13, 18, 23], [
    line("비가 와서 공원에 못 가요.", "Because it's raining, we can't go to the park.", "비가 와서"),
    line("그럼 계획을 바꿔요.", "Then let's change the plan.", "바꿔요"),
    line("카페에 갈까요?", "Shall we go to a cafe?", "갈까요"),
    line("좋아요. 밖이 추워서 따뜻한 라떼를 마시고 싶어요.", "Good. Because it's cold outside, I want to drink a warm latte.", "추워서"),
    line("저는 피곤해서 일찍 집에 갈 거예요.", "I'm tired, so I'll go home early.", "피곤해서"),
    line("리암 씨가 늦어서 문자 보냈어요.", "Liam was late, so he sent a text.", "늦어서"),
    line("전화도 했어요?", "Did he call too?", "전화"),
    line("네, 방금 전화했어요.", "Yes, he just called.", "전화했어요"),
    line("아, 다행이에요.", "Oh, that's a relief.", "다행이에요"),
    line("비가 와도 오늘은 우울하지 않아요.", "Even though it's raining, I'm not down today.", "우울하지 않아요")
  ]),
  lesson(25, "A1", "But I Have Class", "Friends negotiate plans with contrasts and background." , ["-지만 but", "-는데 for soft background"], [
    v("좋지만", "좋다", "good but", "clause"), v("비싸지만", "비싸다", "expensive but", "clause"), v("가고 싶은데", "가고 싶다", "I want to go, but/and", "clause"), v("있는데", "있다", "there is, and/but", "clause"), v("없는데", "없다", "there isn't, so/but", "clause"), v("시간", "시간", "time", "noun"), v("돈", "돈", "money", "noun"), v("자리", "자리", "seat; place", "noun"), v("괜찮은데요", "괜찮다", "it is okay, though", "phrase"), v("문제", "문제", "problem", "noun"), v("괜히", "괜히", "for no good reason", "adverb"), v("걱정", "걱정", "worry", "noun"), v("걱정해요", "걱정하다", "worry", "verb"), v("방법", "방법", "method; way", "noun"), v("생각해요", "생각하다", "think", "verb")
  ], [idiom("시간이 없어요", "I don't have time.", "Literally 'time does not exist.' Natural for being busy; neutral form is 시간이 없다.")], [18, 23, 24], [
    line("영화가 좋지만 조금 비싸요.", "The movie is good, but it's a little expensive.", "좋지만"),
    line("저도 가고 싶은데 시간이 없어요.", "I want to go too, but I don't have time.", "가고 싶은데"),
    line("오늘 수업이 있는데요.", "I have class today, you know.", "있는데요"),
    line("그럼 내일은 어때요?", "Then how about tomorrow?", "어때요"),
    line("내일은 괜찮은데요.", "Tomorrow is okay, actually.", "괜찮은데요"),
    line("돈은 조금 없지만 괜찮아요.", "I don't have much money, but it's okay.", "없지만"),
    line("자리도 있어요?", "Are there seats too?", "자리도 있어요"),
    line("네, 문제 없어요.", "Yes, no problem.", "문제 없어요"),
    line("괜히 걱정했어요.", "I worried for nothing.", "걱정했어요"),
    line("좋은 방법을 생각했네요.", "You came up with a good way.", "생각했네요")
  ]),
  lesson(26, "A1", "Polite Instructions at the Clinic", "A receptionist and patient use polite requests.", ["Honorific/request -(으)세요", "Please do X with verb stems"], [
    v("들어오세요", "들어오다", "please come in", "verb"), v("앉으세요", "앉다", "please sit", "verb"), v("기다리세요", "기다리다", "please wait", "verb"), v("보세요", "보다", "please look; try seeing", "verb"), v("말씀하세요", "말씀하다", "please tell/speak", "verb"), v("이쪽", "이쪽", "this way", "noun"), v("저쪽", "저쪽", "that way", "noun"), v("접수", "접수", "reception; registration", "noun"), v("이름표", "이름표", "name tag", "noun"), v("서류", "서류", "document", "noun"), v("작성하세요", "작성하다", "please fill out", "verb"), v("서명하세요", "서명하다", "please sign", "verb"), v("잠시", "잠시", "a moment", "noun"), v("확인", "확인", "checking; confirmation", "noun"), v("여유 있게", "여유 있다", "without rushing", "phrase")
  ], [idiom("잠깐만요", "Just a second.", "Literally 'only a short moment.' Very common when asking someone to wait; a slightly more formal version is 잠시만요.")], [14, 22, 24], [
    line("안녕하세요. 이쪽으로 들어오세요.", "Hello. Please come in this way.", "들어오세요"),
    line("여기에 앉으세요.", "Please sit here.", "앉으세요"),
    line("이름을 말씀하세요.", "Please tell me your name.", "말씀하세요"),
    line("리암이에요. 잠깐만요, 여권이 가방에 있어요.", "It's Liam. Just a second, my passport is in my bag.", "잠깐만요"),
    line("괜찮아요. 천천히 보세요.", "That's okay. Take your time and look.", "보세요"),
    line("이 서류를 작성하세요.", "Please fill out this document.", "작성하세요"),
    line("여기에 서명하세요.", "Please sign here.", "서명하세요"),
    line("접수 후에 잠시 기다리세요.", "Please wait a moment after registration.", "기다리세요"),
    line("이름표도 확인하세요.", "Please check the name tag too.", "확인하세요"),
    line("네, 감사합니다. 저쪽에서 기다릴게요.", "Yes, thank you. I'll wait over there.", "기다릴게요")
  ]),
  lesson(27, "A1", "Trying Korean Food", "Friends encourage each other to try food.", ["-아/어 보다 try doing", "Have you tried...? -아/어 봤어요"], [
    v("먹어 봤어요", "먹어 보다", "have tried eating", "phrase"), v("마셔 봤어요", "마셔 보다", "have tried drinking", "phrase"), v("가 봤어요", "가 보다", "have tried going; have been", "phrase"), v("해 봤어요", "해 보다", "have tried doing", "phrase"), v("매워요", "맵다", "is spicy", "adjective"), v("달아요", "달다", "is sweet", "adjective"), v("짜요", "짜다", "is salty", "adjective"), v("싱거워요", "싱겁다", "is bland", "adjective"), v("고기", "고기", "meat", "noun"), v("생선", "생선", "fish", "noun"), v("채소", "채소", "vegetable", "noun"), v("반찬", "반찬", "side dish", "noun"), v("국", "국", "soup", "noun"), v("숟가락", "숟가락", "spoon", "noun"), v("젓가락", "젓가락", "chopsticks", "noun")
  ], [idiom("입에 맞아요", "It suits my taste.", "Literally 'it fits the mouth.' Used for food that tastes good to you personally.")], [10, 21, 26], [
    line("김치찌개 먹어 봤어요?", "Have you tried kimchi stew?", "먹어 봤어요"),
    line("아니요, 아직 안 먹어 봤어요.", "No, I haven't tried it yet.", "안 먹어 봤어요"),
    line("조금 매워요. 그래도 맛있어요.", "It's a little spicy. Still, it's good.", "매워요"),
    line("이 반찬도 먹어 보세요.", "Try this side dish too.", "먹어 보세요"),
    line("오, 제 입에 맞아요.", "Oh, it suits my taste.", "입에 맞아요"),
    line("국은 조금 짜요?", "Is the soup a little salty?", "짜요"),
    line("아니요, 싱거워요. 소금이 필요해요.", "No, it's bland. It needs salt.", "싱거워요"),
    line("젓가락 사용해 봤어요?", "Have you tried using chopsticks?", "사용해 봤어요"),
    line("네, 하지만 아직 어려워요.", "Yes, but it's still hard.", "어려워요"),
    line("괜찮아요. 숟가락도 같이 써요.", "That's okay. Use a spoon too.", "써요")
  ]),
  lesson(28, "A1", "Can You Come?", "A small group checks abilities and availability.", ["-(으)ㄹ 수 있어요 can", "-(으)ㄹ 수 없어요 cannot"], [
    v("갈 수 있어요", "가다", "can go", "phrase"), v("올 수 있어요", "오다", "can come", "phrase"), v("먹을 수 있어요", "먹다", "can eat", "phrase"), v("읽을 수 있어요", "읽다", "can read", "phrase"), v("말할 수 있어요", "말하다", "can speak", "phrase"), v("운전할 수 있어요", "운전하다", "can drive", "phrase"), v("수영할 수 있어요", "수영하다", "can swim", "phrase"), v("요리할 수 있어요", "요리하다", "can cook", "phrase"), v("도와줄 수 있어요", "도와주다", "can help", "phrase"), v("혼자", "혼자", "alone", "adverb"), v("함께", "함께", "together", "adverb"), v("가능해요", "가능하다", "is possible", "adjective"), v("불가능해요", "불가능하다", "is impossible", "adjective"), v("아직", "아직", "yet; still", "adverb"), v("벌써", "벌써", "already", "adverb")
  ], [idiom("문제없어요", "No problem.", "Literally 'there is no problem.' Common reassurance; often pronounced smoothly as 문제 없어요.")], [18, 24, 27], [
    line("오늘 저녁에 올 수 있어요?", "Can you come this evening?", "올 수 있어요"),
    line("네, 갈 수 있어요.", "Yes, I can go.", "갈 수 있어요"),
    line("혼자 올 거예요?", "Will you come alone?", "혼자"),
    line("아니요, 친구와 함께 갈 거예요.", "No, I'll go with a friend.", "함께"),
    line("한국어를 조금 말할 수 있어요?", "Can you speak a little Korean?", "말할 수 있어요"),
    line("네, 읽을 수 있지만 빨리 말할 수 없어요.", "Yes, I can read, but I can't speak fast.", "말할 수 없어요"),
    line("요리할 수 있어요?", "Can you cook?", "요리할 수 있어요"),
    line("라면은 만들 수 있어요.", "I can make ramyeon.", "만들 수 있어요"),
    line("그럼 저를 도와줄 수 있어요?", "Then can you help me?", "도와줄 수 있어요"),
    line("네, 문제없어요.", "Yes, no problem.", "문제없어요")
  ]),
  lesson(29, "A1", "Things We Have To Do", "Roommates plan errands before guests arrive.", ["-아/어야 해요 have to", "Prioritizing tasks"], [
    v("청소해야 해요", "청소하다", "have to clean", "phrase"), v("빨래해야 해요", "빨래하다", "have to do laundry", "phrase"), v("준비해야 해요", "준비하다", "have to prepare", "phrase"), v("가야 해요", "가다", "have to go", "phrase"), v("사야 해요", "사다", "have to buy", "phrase"), v("전화해야 해요", "전화하다", "have to call", "phrase"), v("보내야 해요", "보내다", "have to send", "phrase"), v("방", "방", "room", "noun"), v("부엌", "부엌", "kitchen", "noun"), v("욕실", "욕실", "bathroom", "noun"), v("쓰레기", "쓰레기", "trash", "noun"), v("초대", "초대", "invitation", "noun"), v("손님", "손님", "guest; customer", "noun"), v("빨리", "빨리", "quickly", "adverb"), v("우선", "우선", "first of all", "adverb")
  ], [idiom("정신없어요", "It's hectic; I'm overwhelmed.", "Literally 'there is no mind/spirit.' Used when things are chaotic or you are too busy to think clearly.")], [12, 23, 28], [
    line("오늘 손님이 와서 준비해야 해요.", "Guests are coming today, so we have to prepare.", "준비해야 해요"),
    line("먼저 방을 청소해야 해요.", "First we have to clean the room.", "청소해야 해요"),
    line("부엌도 청소해야 해요?", "Do we have to clean the kitchen too?", "청소해야 해요"),
    line("네, 그리고 쓰레기를 버려야 해요.", "Yes, and we have to throw out the trash.", "버려야 해요"),
    line("저는 빨래해야 해요.", "I have to do laundry.", "빨래해야 해요"),
    line("마트에 가서 음식을 사야 해요.", "We have to go to the mart and buy food.", "사야 해요"),
    line("손님에게 문자도 보내야 해요.", "We have to send the guests a text too.", "보내야 해요"),
    line("와, 오늘 진짜 정신없어요.", "Wow, today is really hectic.", "정신없어요"),
    line("그래도 빨리 끝낼 수 있어요.", "Still, we can finish quickly.", "끝낼 수 있어요"),
    line("좋아요. 저는 지금 전화해야 해요.", "Good. I have to call now.", "전화해야 해요")
  ]),
  lesson(30, "A1", "What Are You Doing Now?", "Friends message each other in the middle of activities.", ["-고 있어요 progressive", "지금 ongoing actions"], [
    v("하고 있어요", "하다", "am doing", "phrase"), v("먹고 있어요", "먹다", "am eating", "phrase"), v("보고 있어요", "보다", "am watching", "phrase"), v("읽고 있어요", "읽다", "am reading", "phrase"), v("기다리고 있어요", "기다리다", "am waiting", "phrase"), v("공부하고 있어요", "공부하다", "am studying", "phrase"), v("일하고 있어요", "일하다", "am working", "phrase"), v("걷고 있어요", "걷다", "am walking", "phrase"), v("듣고 있어요", "듣다", "am listening", "phrase"), v("요즘", "요즘", "these days", "noun"), v("메시지", "메시지", "message", "noun"), v("드라마", "드라마", "TV drama", "noun"), v("뉴스", "뉴스", "news", "noun"), v("노트북", "노트북", "laptop", "noun"), v("이어폰", "이어폰", "earphones", "noun")
  ], [idiom("뭐 해요?", "What are you up to?", "Literally 'what do you do?' In casual polite conversation it often means 'what are you doing now?'")], [12, 24, 29], [
    line("지금 뭐 해요?", "What are you up to right now?", "뭐 해요"),
    line("저는 카페에서 공부하고 있어요.", "I'm studying at a cafe.", "공부하고 있어요"),
    line("노트북으로 숙제를 하고 있어요.", "I'm doing homework on my laptop.", "하고 있어요"),
    line("저는 집에서 드라마를 보고 있어요.", "I'm watching a drama at home.", "보고 있어요"),
    line("음악도 듣고 있어요?", "Are you listening to music too?", "듣고 있어요"),
    line("네, 이어폰으로 듣고 있어요.", "Yes, I'm listening with earphones.", "듣고 있어요"),
    line("민지 씨는 누구를 기다리고 있어요?", "Minji, who are you waiting for?", "기다리고 있어요"),
    line("친구를 기다리고 있어요.", "I'm waiting for a friend.", "기다리고 있어요"),
    line("요즘 한국 뉴스를 읽고 있어요.", "These days I'm reading Korean news.", "읽고 있어요"),
    line("좋네요. 저는 지금 걸어가고 있어요.", "Nice. I'm walking there now.", "걸어가고 있어요")
  ]),
  lesson(31, "A1", "Step by Step", "A learner explains the order of a simple routine.", ["Verb + 고 sequence", "그리고 vs -고"], [
    v("씻고", "씻다", "wash and", "clause"), v("먹고", "먹다", "eat and", "clause"), v("마시고", "마시다", "drink and", "clause"), v("입고", "입다", "wear and", "clause"), v("나가요", "나가다", "go out", "verb"), v("들어가요", "들어가다", "go in", "verb"), v("도착해요", "도착하다", "arrive", "verb"), v("시작하고", "시작하다", "start and", "clause"), v("끝나고", "끝나다", "end and", "clause"), v("정리해요", "정리하다", "organize; tidy", "verb"), v("샤워", "샤워", "shower", "noun"), v("이를 닦아요", "이를 닦다", "brush teeth", "phrase"), v("코트", "코트", "coat", "noun"), v("신발", "신발", "shoes", "noun"), v("열쇠", "열쇠", "key", "noun")
  ], [idiom("잘 다녀오세요", "Have a good trip/errand.", "Literally 'go and come back well.' Said to someone leaving and expected to return.")], [12, 29, 30], [
    line("아침에 일어나고 샤워해요.", "In the morning I get up and shower.", "일어나고"),
    line("그리고 이를 닦아요.", "And then I brush my teeth.", "이를 닦아요"),
    line("밥을 먹고 커피를 마셔요.", "I eat and drink coffee.", "먹고"),
    line("코트를 입고 신발을 신어요.", "I put on a coat and shoes.", "입고"),
    line("열쇠를 가지고 나가요.", "I take my key and go out.", "나가요"),
    line("회사에 도착하고 일을 시작해요.", "I arrive at work and start working.", "도착하고"),
    line("수업이 끝나고 카페에 가요.", "After class ends, I go to a cafe.", "끝나고"),
    line("집에 들어가고 방을 정리해요.", "I go into the house and tidy my room.", "들어가고"),
    line("오늘도 바쁘네요.", "You're busy again today.", "바쁘네요"),
    line("네, 다녀올게요. 잘 다녀오세요.", "Yes, I'll be back. Have a good trip.", "잘 다녀오세요")
  ]),
  lesson(32, "A1", "Before and After Class", "Classmates compare what they do around class time.", ["-기 전에 before doing", "-(으)ㄴ 후에 after doing"], [
    v("가기 전에", "가다", "before going", "clause"), v("먹기 전에", "먹다", "before eating", "clause"), v("수업 전에", "수업", "before class", "phrase"), v("수업 후에", "수업", "after class", "phrase"), v("운동 후에", "운동", "after exercise", "phrase"), v("자기 전에", "자다", "before sleeping", "clause"), v("아침 식사", "아침 식사", "breakfast", "noun"), v("저녁 식사", "저녁 식사", "dinner", "noun"), v("복습", "복습", "review", "noun"), v("예습", "예습", "previewing lesson material", "noun"), v("샤워해요", "샤워하다", "shower", "verb"), v("양치해요", "양치하다", "brush teeth", "verb"), v("준비해요", "준비하다", "prepare", "verb"), v("확인해요", "확인하다", "check", "verb"), v("잊어버려요", "잊어버리다", "forget", "verb")
  ], [idiom("깜빡했어요", "It slipped my mind.", "Literally from 깜빡하다, to blink/forget briefly. Common, casual-polite way to admit forgetting something.")], [12, 29, 31], [
    line("수업 전에 뭐 해요?", "What do you do before class?", "수업 전에"),
    line("수업 전에 예습해요.", "I preview the lesson before class.", "예습해요"),
    line("저는 카페에 가기 전에 아침 식사를 해요.", "Before going to the cafe, I eat breakfast.", "가기 전에"),
    line("먹기 전에 손을 씻어요.", "I wash my hands before eating.", "먹기 전에"),
    line("수업 후에 복습해요?", "Do you review after class?", "수업 후에"),
    line("네, 집에서 조금 복습해요.", "Yes, I review a little at home.", "복습해요"),
    line("운동 후에 샤워해요.", "I shower after exercise.", "운동 후에"),
    line("자기 전에 이를 닦아요.", "I brush my teeth before sleeping.", "자기 전에"),
    line("숙제 확인했어요?", "Did you check the homework?", "확인했어요"),
    line("아, 깜빡했어요. 지금 할게요.", "Oh, it slipped my mind. I'll do it now.", "깜빡했어요")
  ]),
  lesson(33, "A1", "Making an Appointment", "Two people schedule a study session.", ["약속을 잡다 set an appointment", "몇 시쯤 around what time"], [
    v("약속을 잡아요", "약속을 잡다", "set an appointment", "phrase"), v("시간이 나요", "시간이 나다", "have time available", "phrase"), v("언제쯤", "언제쯤", "around when", "adverb"), v("몇 시쯤", "몇 시쯤", "around what time", "phrase"), v("가능하세요", "가능하다", "are you available?", "adjective"), v("괜찮으세요", "괜찮다", "is it okay for you?", "adjective"), v("회의", "회의", "meeting", "noun"), v("스터디", "스터디", "study group", "noun"), v("장소", "장소", "place; location", "noun"), v("날짜", "날짜", "date", "noun"), v("바꿔도 돼요", "바꾸다", "may change", "phrase"), v("확정해요", "확정하다", "confirm", "verb"), v("캘린더", "캘린더", "calendar", "noun"), v("메모", "메모", "memo; note", "noun"), v("괜찮다면", "괜찮다", "if it's okay", "clause")
  ], [idiom("시간이 나요", "I have a free opening.", "Literally 'time comes out.' Used when your schedule opens up.")], [8, 23, 25], [
    line("이번 주에 스터디 약속을 잡아요.", "Let's set a study appointment this week.", "약속을 잡아요"),
    line("언제쯤 시간이 나요?", "Around when do you have time?", "시간이 나요"),
    line("수요일 오후에 시간이 나요.", "I have time Wednesday afternoon.", "시간이 나요"),
    line("몇 시쯤 가능하세요?", "Around what time are you available?", "몇 시쯤"),
    line("세 시쯤 괜찮으세요?", "Is around three okay for you?", "괜찮으세요"),
    line("네, 장소는 도서관 어때요?", "Yes, how about the library as the place?", "장소는"),
    line("괜찮다면 카페로 바꿔도 돼요?", "If it's okay, may we change it to a cafe?", "바꿔도 돼요"),
    line("좋아요. 그럼 날짜하고 장소를 확정해요.", "Good. Then let's confirm the date and place.", "확정해요"),
    line("캘린더에 메모했어요.", "I noted it on my calendar.", "메모했어요"),
    line("회의 후에 바로 갈게요.", "I'll go right after the meeting.", "갈게요")
  ]),
  lesson(34, "A1", "At the Pharmacy", "A sick learner asks for medicine.", ["Symptoms with 이/가 아파요", "Please give me medicine for..."], [
    v("감기", "감기", "cold", "noun"), v("열이 있어요", "열이 있다", "have a fever", "phrase"), v("기침", "기침", "cough", "noun"), v("목", "목", "throat; neck", "noun"), v("코", "코", "nose", "noun"), v("콧물", "콧물", "runny nose", "noun"), v("두통", "두통", "headache", "noun"), v("진통제", "진통제", "painkiller", "noun"), v("감기약", "감기약", "cold medicine", "noun"), v("1일", "1일", "one day", "noun"), v("두 번", "두 번", "twice", "phrase"), v("식후", "식후", "after meals", "noun"), v("드세요", "들다", "please take/eat", "verb"), v("나아요", "낫다", "get better", "verb"), v("조심하세요", "조심하다", "be careful", "verb")
  ], [idiom("감기 기운이 있어요", "I feel like I'm coming down with a cold.", "Literally 'there is a cold energy/sign.' Common way to describe early cold symptoms.")], [22, 26, 27], [
    line("감기 기운이 있어요.", "I feel like I'm coming down with a cold.", "감기 기운이 있어요"),
    line("열도 조금 있어요.", "I also have a slight fever.", "열도"),
    line("목이 아파요?", "Does your throat hurt?", "목이 아파요"),
    line("네, 목이 아프고 기침도 해요.", "Yes, my throat hurts and I cough too.", "아프고"),
    line("콧물도 나요?", "Do you have a runny nose too?", "콧물도"),
    line("조금요. 두통도 있어요.", "A little. I have a headache too.", "두통도"),
    line("그럼 감기약하고 진통제 주세요.", "Then cold medicine and painkillers, please.", "주세요"),
    line("하루 두 번, 식후에 드세요.", "Take it twice a day after meals.", "드세요"),
    line("며칠 후에 나을까요?", "Will I get better after a few days?", "나을까요"),
    line("푹 쉬세요. 날씨가 추우니까 조심하세요.", "Rest well. Be careful because the weather is cold.", "조심하세요")
  ]),
  lesson(35, "A1", "Housework Night", "Roommates divide chores naturally.", ["Can/should review in domestic context", "Verb nominal task phrases"], [
    v("집안일", "집안일", "housework", "noun"), v("설거지", "설거지", "dishwashing", "noun"), v("설거지해요", "설거지하다", "wash dishes", "verb"), v("청소기", "청소기", "vacuum cleaner", "noun"), v("청소기를 돌려요", "청소기를 돌리다", "run the vacuum", "phrase"), v("바닥", "바닥", "floor", "noun"), v("닦아요", "닦다", "wipe; brush", "verb"), v("정리", "정리", "tidying", "noun"), v("냉장고", "냉장고", "refrigerator", "noun"), v("쓰레기봉투", "쓰레기봉투", "trash bag", "noun"), v("분리수거", "분리수거", "recycling sorting", "noun"), v("세탁기", "세탁기", "washing machine", "noun"), v("돌려요", "돌리다", "run; turn", "verb"), v("말려요", "말리다", "dry", "verb"), v("깨끗해요", "깨끗하다", "is clean", "adjective")
  ], [idiom("손이 많이 가요", "It takes a lot of work.", "Literally 'hands go a lot.' Used for tasks, food, or people that require lots of care.")], [29, 30, 31], [
    line("오늘 집안일이 많아요.", "There's a lot of housework today.", "집안일이 많아요"),
    line("설거지는 제가 할게요.", "I'll do the dishes.", "설거지는"),
    line("그럼 저는 청소기를 돌릴게요.", "Then I'll run the vacuum.", "청소기를 돌릴게요"),
    line("바닥도 닦아야 해요.", "We have to wipe the floor too.", "닦아야 해요"),
    line("냉장고 정리는 손이 많이 가요.", "Organizing the fridge takes a lot of work.", "손이 많이 가요"),
    line("쓰레기봉투가 어디 있어요?", "Where are the trash bags?", "쓰레기봉투"),
    line("부엌 아래에 있어요.", "They're under the kitchen counter.", "아래에"),
    line("분리수거도 해야 해요?", "Do we have to sort recycling too?", "분리수거도"),
    line("네, 세탁기도 돌리고 빨래를 말려야 해요.", "Yes, and we have to run the washer and dry the laundry.", "돌리고"),
    line("끝나면 집이 깨끗할 거예요.", "When we finish, the house will be clean.", "깨끗할 거예요")
  ]),
  lesson(36, "A1", "Checking Into a Hotel", "A traveler handles a hotel check-in.", ["예약했어요 and confirmation language", "으/로 for room/payment direction"], [
    v("호텔", "호텔", "hotel", "noun"), v("체크인", "체크인", "check-in", "noun"), v("체크아웃", "체크아웃", "checkout", "noun"), v("예약했어요", "예약하다", "reserved", "verb"), v("방 번호", "방 번호", "room number", "noun"), v("카드키", "카드키", "key card", "noun"), v("여권", "여권", "passport", "noun"), v("서명", "서명", "signature", "noun"), v("조식", "조식", "breakfast at lodging", "noun"), v("포함", "포함", "included", "noun"), v("층", "층", "floor", "counter"), v("엘리베이터", "엘리베이터", "elevator", "noun"), v("와이파이", "와이파이", "Wi-Fi", "noun"), v("비밀번호", "비밀번호", "password", "noun"), v("편해요", "편하다", "is comfortable", "adjective")
  ], [idiom("편하게 쉬세요", "Rest comfortably; make yourself comfortable.", "A warm service phrase, literally 'rest comfortably.' Used by hosts/staff.")], [23, 26, 33], [
    line("안녕하세요. 체크인하려고 왔어요.", "Hello. I came to check in.", "왔어요"),
    line("예약하셨어요?", "Did you make a reservation?", "예약하셨어요"),
    line("네, 리암 이름으로 예약했어요.", "Yes, I reserved under the name Liam.", "예약했어요"),
    line("여권을 보여 주세요.", "Please show me your passport.", "보여 주세요"),
    line("여기에 서명해 주세요.", "Please sign here.", "서명해 주세요"),
    line("방 번호는 오백삼 호예요.", "Your room number is 503.", "방 번호"),
    line("카드키는 두 장 드릴게요.", "I'll give you two key cards.", "드릴게요"),
    line("조식은 포함이에요?", "Is breakfast included?", "포함이에요"),
    line("네, 와이파이 비밀번호는 여기 있어요.", "Yes, the Wi-Fi password is here.", "비밀번호"),
    line("감사합니다. 편하게 쉬세요.", "Thank you. Rest comfortably.", "편하게 쉬세요")
  ]),
  lesson(37, "A1", "Hobbies These Days", "Friends talk about hobbies and frequency.", ["Frequency adverbs with hobbies", "Nominal objects for activities"], [
    v("취미", "취미", "hobby", "noun"), v("독서", "독서", "reading", "noun"), v("산책", "산책", "walk; stroll", "noun"), v("등산", "등산", "hiking", "noun"), v("사진 찍기", "사진 찍기", "taking photos", "noun"), v("그림", "그림", "drawing; picture", "noun"), v("게임", "게임", "game", "noun"), v("요리", "요리", "cooking; dish", "noun"), v("주로", "주로", "mainly", "adverb"), v("거의", "거의", "almost; hardly", "adverb"), v("항상", "항상", "always", "adverb"), v("보통", "보통", "usually", "adverb"), v("가끔씩", "가끔씩", "once in a while", "adverb"), v("실력", "실력", "skill", "noun"), v("늘어요", "늘다", "improve; increase", "verb")
  ], [idiom("시간 가는 줄 몰라요", "Time flies.", "Literally 'I don't know that time is passing.' Used when something is so engaging you lose track of time.")], [12, 18, 30], [
    line("요즘 취미가 뭐예요?", "What's your hobby these days?", "취미가 뭐예요"),
    line("저는 주로 독서를 해요.", "I mainly read.", "독서를 해요"),
    line("저는 보통 산책을 해요.", "I usually take walks.", "산책을 해요"),
    line("주말에는 가끔씩 등산해요.", "On weekends I hike once in a while.", "등산해요"),
    line("민지 씨는 사진 찍기를 좋아해요?", "Minji, do you like taking photos?", "사진 찍기"),
    line("네, 사진 찍으면 시간 가는 줄 몰라요.", "Yes, when I take photos, time flies.", "시간 가는 줄 몰라요"),
    line("저는 게임을 거의 안 해요.", "I hardly play games.", "거의 안 해요"),
    line("요리는 자주 해 봤어요?", "Have you tried cooking often?", "요리"),
    line("네, 실력이 조금 늘었어요.", "Yes, my skill improved a little.", "늘었어요"),
    line("그림도 배우고 싶어요.", "I want to learn drawing too.", "배우고 싶어요")
  ]),
  lesson(38, "A1", "Comparing Options", "Friends choose between restaurants and transport.", ["A보다 B가 더 ...", "더 for more"], [
    v("더", "더", "more", "adverb"), v("보다", "보다", "than", "particle"), v("제일", "제일", "most; best", "adverb"), v("작아요", "작다", "is small", "adjective"), v("커요", "크다", "is big", "adjective"), v("가벼워요", "가볍다", "is light", "adjective"), v("무거워요", "무겁다", "is heavy", "adjective"), v("저렴해요", "저렴하다", "is inexpensive", "adjective"), v("비싼 편이에요", "비싼 편이다", "is on the expensive side", "phrase"), v("맛있는 편이에요", "맛있는 편이다", "is on the tasty side", "phrase"), v("편리해요", "편리하다", "convenient", "adjective"), v("불편해요", "불편하다", "uncomfortable", "adjective"), v("상점", "상점", "shop; store", "noun"), v("선택", "선택", "choice", "noun"), v("추천", "추천", "recommendation", "noun")
  ], [idiom("생각보다 괜찮아요", "It's better than I expected.", "Literally 'it is okay compared with thought.' Very common after trying something.")], [15, 17, 27], [
    line("이 식당이 저 식당보다 더 싸요.", "This restaurant is cheaper than that one.", "보다 더"),
    line("하지만 저 식당이 더 맛있어요.", "But that restaurant is more delicious.", "더 맛있어요"),
    line("버스보다 지하철이 더 빨라요.", "The subway is faster than the bus.", "보다"),
    line("택시는 편하지만 더 비싸요.", "Taxis are comfortable but more expensive.", "더 비싸요"),
    line("이 가방은 작고 가벼워요.", "This bag is small and light.", "가벼워요"),
    line("저 가방은 크지만 무거워요.", "That bag is big but heavy.", "무거워요"),
    line("어느 선택이 좋아요?", "Which choice is good?", "어느"),
    line("저는 이 가게를 추천해요.", "I recommend this shop.", "추천해요"),
    line("가격이 생각보다 괜찮아요.", "The price is better than I expected.", "생각보다 괜찮아요"),
    line("그럼 여기가 제일 좋아요.", "Then this place is best.", "제일")
  ]),
  lesson(39, "A1", "The Best Place Nearby", "Learners rank nearby places.", ["제일/가장 superlatives", "Among choices에서"], [
    v("가장", "가장", "most", "adverb"), v("제일 좋아요", "제일 좋다", "is best; like most", "phrase"), v("근처", "근처", "nearby", "noun"), v("동네", "동네", "neighborhood", "noun"), v("분위기", "분위기", "atmosphere", "noun"), v("서비스", "서비스", "service", "noun"), v("가격", "가격", "price", "noun"), v("위치", "위치", "location", "noun"), v("깔끔해요", "깔끔하다", "is neat; tidy", "adjective"), v("친절해요", "친절하다", "is kind", "adjective"), v("유명해요", "유명하다", "is famous", "adjective"), v("붐벼요", "붐비다", "is crowded", "verb"), v("조용해요", "조용하다", "is quiet", "adjective"), v("최고예요", "최고이다", "is the best", "phrase"), v("별로예요", "별로이다", "not great", "phrase")
  ], [idiom("말 그대로 최고예요", "It's literally the best.", "말 그대로 means 'as the words say/literally.' Used for emphasis, not a proverb.")], [16, 25, 38], [
    line("이 동네에서 어디가 제일 좋아요?", "Where is the best in this neighborhood?", "제일 좋아요"),
    line("저는 역 근처 카페가 가장 좋아요.", "I like the cafe near the station most.", "가장 좋아요"),
    line("분위기가 조용하고 깨끗해요.", "The atmosphere is quiet and clean.", "조용하고"),
    line("서비스도 친절해요.", "The service is kind too.", "친절해요"),
    line("가격은 어때요?", "How are the prices?", "가격은"),
    line("생각보다 비싸지 않아요.", "They're not as expensive as I expected.", "비싸지 않아요"),
    line("저 식당은 유명하지만 너무 붐벼요.", "That restaurant is famous but too crowded.", "붐벼요"),
    line("위치는 좋아요?", "Is the location good?", "위치는"),
    line("네, 하지만 음식은 별로예요.", "Yes, but the food isn't great.", "별로예요"),
    line("그 카페는 말 그대로 최고예요.", "That cafe is literally the best.", "말 그대로 최고예요")
  ]),
  lesson(40, "A1", "Because It's Close", "Friends explain recommendations with a practical reason.", ["-(으)니까 because/since", "Using 니까 for suggestions"], [
    v("가까우니까", "가깝다", "because it is close", "clause"), v("싸니까", "싸다", "because it is cheap", "clause"), v("맛있으니까", "맛있다", "because it is delicious", "clause"), v("바쁘니까", "바쁘다", "because busy", "clause"), v("늦었으니까", "늦다", "because it is late", "clause"), v("추천하니까", "추천하다", "because someone recommends", "clause"), v("가져와요", "가져오다", "bring", "verb"), v("가져가요", "가져가다", "take along", "verb"), v("예약하세요", "예약하다", "please reserve", "verb"), v("서두르세요", "서두르다", "please hurry", "verb"), v("문 닫아요", "문 닫다", "close for business", "phrase"), v("열려 있어요", "열려 있다", "is open", "phrase"), v("자료", "자료", "materials; data", "noun"), v("지도", "지도", "map", "noun"), v("충전기", "충전기", "charger", "noun")
  ], [idiom("그럴 만해요", "That makes sense; it's understandable.", "Literally 'it is worth being so.' Used when a reason explains the situation.")], [16, 25, 39], [
    line("여기가 가까우니까 여기서 만나요.", "Since this place is close, let's meet here.", "가까우니까"),
    line("그 식당은 맛있으니까 예약하세요.", "That restaurant is good, so make a reservation.", "맛있으니까"),
    line("오늘은 바쁘니까 빨리 먹어요.", "Since we're busy today, let's eat quickly.", "바쁘니까"),
    line("늦었으니까 서두르세요.", "Since it's late, please hurry.", "늦었으니까"),
    line("카페가 아직 열려 있으니까 괜찮아요.", "The cafe is still open, so it's okay.", "열려 있으니까"),
    line("문은 열 시에 닫아요.", "It closes at ten.", "닫아요"),
    line("자료를 가져와야 해요?", "Do I have to bring the materials?", "가져와야 해요"),
    line("네, 지도하고 충전기도 가져오세요.", "Yes, bring the map and charger too.", "가져오세요"),
    line("사람들이 추천하니까 가 보고 싶어요.", "People recommend it, so I want to try going.", "추천하니까"),
    line("아, 그럴 만해요. 분위기가 좋네요.", "Ah, that makes sense. The atmosphere is nice.", "그럴 만해요")
  ]),
  lesson(41, "A2", "What People Say", "A learner relays simple information from others.", ["-다고 해요 reported statements", "N이라고 해요 called/named"], [
    v("라고 해요", "라고 하다", "is called; says quote", "phrase"), v("이라고 해요", "이라고 하다", "is called after consonant", "phrase"), v("좋다고 해요", "좋다", "they say it is good", "phrase"), v("비싸다고 해요", "비싸다", "they say it is expensive", "phrase"), v("간다고 해요", "가다", "says someone is going", "phrase"), v("온다고 해요", "오다", "says someone is coming", "phrase"), v("친구 말로는", "친구 말로는", "according to my friend", "phrase"), v("소문", "소문", "rumor", "noun"), v("사실", "사실", "fact; actually", "noun"), v("직원", "직원", "employee; staff", "noun"), v("사장님", "사장님", "owner; boss", "noun"), v("새로", "새로", "newly", "adverb"), v("열었어요", "열다", "opened", "verb"), v("닫았어요", "닫다", "closed", "verb"), v("물어봤어요", "물어보다", "asked", "verb")
  ], [idiom("말이 많아요", "People are talking about it.", "Literally 'there are many words.' Can mean gossip or buzz depending on context; here it means there is chatter.")], [25, 33, 39], [
    line("친구 말로는 새 카페가 좋다고 해요.", "According to my friend, the new cafe is good.", "좋다고 해요"),
    line("이름은 달빛 카페라고 해요.", "It's called Moonlight Cafe.", "라고 해요"),
    line("가격은 조금 비싸다고 해요.", "They say the prices are a little expensive.", "비싸다고 해요"),
    line("그래도 분위기가 최고라고 해요.", "Still, they say the atmosphere is the best.", "최고라고 해요"),
    line("민지 씨도 간다고 해요?", "Does Minji say she's going too?", "간다고 해요"),
    line("네, 오늘 저녁에 온다고 해요.", "Yes, she says she's coming this evening.", "온다고 해요"),
    line("직원에게 시간도 물어봤어요.", "I asked the staff the hours too.", "물어봤어요"),
    line("사장님이 어제 새로 열었다고 해요.", "They say the owner opened it yesterday.", "열었다고 해요"),
    line("요즘 그 카페는 말이 많아요.", "People are talking about that cafe these days.", "말이 많아요"),
    line("소문인지 사실인지 가서 봐요.", "Let's go see whether it's rumor or fact.", "사실인지")
  ]),
  lesson(42, "A2", "Doing Things Is Fun", "Learners talk about activities as nouns.", ["Verb + 는 것 nominalization", "좋아하는 것/어려운 것"], [
    v("하는 것", "하다", "doing; the act of doing", "phrase"), v("먹는 것", "먹다", "eating", "phrase"), v("읽는 것", "읽다", "reading", "phrase"), v("걷는 것", "걷다", "walking", "phrase"), v("배우는 것", "배우다", "learning", "phrase"), v("어려운 것", "어렵다", "difficult thing", "phrase"), v("쉬운 것", "쉽다", "easy thing", "phrase"), v("좋아하는 것", "좋아하다", "thing one likes", "phrase"), v("싫어하는 것", "싫어하다", "thing one dislikes", "phrase"), v("중요한 것", "중요하다", "important thing", "phrase"), v("발표", "발표", "presentation", "noun"), v("연락", "연락", "contact", "noun"), v("실수", "실수", "mistake", "noun"), v("고치는 것", "고치다", "fixing", "phrase"), v("계속", "계속", "continuously; keep", "adverb")
  ], [idiom("별거 아니에요", "It's no big deal.", "Literally 'it is not a special thing.' Used to downplay a favor, mistake, or worry.")], [20, 27, 37], [
    line("한국어를 배우는 것은 재미있어요.", "Learning Korean is fun.", "배우는 것"),
    line("하지만 발음을 고치는 것은 어려워요.", "But fixing pronunciation is hard.", "고치는 것"),
    line("저는 읽는 것을 좋아해요.", "I like reading.", "읽는 것"),
    line("말하는 것은 아직 조금 무서워요.", "Speaking is still a little scary.", "말하는 것"),
    line("실수하는 것은 괜찮아요.", "Making mistakes is okay.", "실수하는 것"),
    line("계속 연습하는 것이 중요해요.", "Continuing to practice is important.", "연습하는 것"),
    line("민지 씨가 도와준 것은 정말 고마워요.", "I'm really grateful that Minji helped.", "도와준 것"),
    line("아니에요, 별거 아니에요.", "No, it's no big deal.", "별거 아니에요"),
    line("발표하는 것은 어때요?", "How is giving a presentation?", "발표하는 것"),
    line("준비하면 할 수 있어요.", "If I prepare, I can do it.", "할 수 있어요")
  ]),
  lesson(43, "A2", "The Person I Met", "A learner describes people and things with relative clauses.", ["-(으)ㄴ/는 noun modifiers", "Past vs present modifiers"], [
    v("만난 사람", "만나다", "the person I met", "phrase"), v("가는 곳", "가다", "the place someone goes", "phrase"), v("읽은 책", "읽다", "the book someone read", "phrase"), v("먹은 음식", "먹다", "the food someone ate", "phrase"), v("좋아하는 영화", "좋아하다", "movie someone likes", "phrase"), v("사는 동네", "살다", "neighborhood someone lives in", "phrase"), v("입은 옷", "입다", "clothes someone wore", "phrase"), v("찍은 사진", "찍다", "photo someone took", "phrase"), v("쓴 글", "쓰다", "writing someone wrote", "phrase"), v("필요한 것", "필요하다", "thing needed", "phrase"), v("소개", "소개", "introduction", "noun"), v("기억", "기억", "memory", "noun"), v("느낌", "느낌", "feeling; impression", "noun"), v("비슷해요", "비슷하다", "is similar", "adjective"), v("달라요", "다르다", "is different", "adjective")
  ], [idiom("기억에 남아요", "It sticks in my memory.", "Literally 'it remains in memory.' Used for memorable people, events, food, or scenes.")], [21, 37, 42], [
    line("어제 만난 사람이 누구예요?", "Who is the person you met yesterday?", "만난 사람"),
    line("한국어 수업에서 만난 친구예요.", "It's a friend I met in Korean class.", "만난 친구"),
    line("그 친구가 사는 동네는 어디예요?", "Where is the neighborhood that friend lives in?", "사는 동네"),
    line("역 근처에 산다고 해요.", "They say they live near the station.", "산다고 해요"),
    line("요즘 읽은 책이 있어요?", "Is there a book you've read recently?", "읽은 책"),
    line("네, 여행에 관한 책을 읽었어요.", "Yes, I read a book about travel.", "읽었어요"),
    line("좋아하는 영화는 뭐예요?", "What's a movie you like?", "좋아하는 영화"),
    line("제가 찍은 사진도 볼래요?", "Do you want to see the photo I took too?", "찍은 사진"),
    line("와, 이 사진은 느낌이 좋아요.", "Wow, this photo has a nice feel.", "느낌이 좋아요"),
    line("그날 먹은 음식이 아직 기억에 남아요.", "The food we ate that day still sticks in my memory.", "기억에 남아요")
  ]),
  lesson(44, "A2", "If It Rains", "Friends make conditional backup plans.", ["-(으)면 if/when", "Conditional suggestions"], [
    v("비가 오면", "비가 오다", "if it rains", "clause"), v("시간이 있으면", "시간이 있다", "if there is time", "clause"), v("괜찮으면", "괜찮다", "if it is okay", "clause"), v("배고프면", "배고프다", "if hungry", "clause"), v("피곤하면", "피곤하다", "if tired", "clause"), v("길을 잃으면", "길을 잃다", "if lost", "clause"), v("필요하면", "필요하다", "if needed", "clause"), v("연락해요", "연락하다", "contact", "verb"), v("쉬어도 돼요", "쉬다", "may rest", "phrase"), v("취소해도 돼요", "취소하다", "may cancel", "phrase"), v("우산을 가져가요", "우산을 가져가다", "take an umbrella", "phrase"), v("배고파요", "배고프다", "hungry", "adjective"), v("목마라요", "목마르다", "thirsty", "adjective"), v("안전해요", "안전하다", "safe", "adjective"), v("위험해요", "위험하다", "dangerous", "adjective")
  ], [idiom("길을 잃다", "to get lost", "Literally 'lose the road/way.' Common expression for being lost while traveling or walking.")], [13, 24, 33], [
    line("내일 비가 오면 우산을 가져가요.", "If it rains tomorrow, take an umbrella.", "비가 오면"),
    line("비가 많이 오면 약속을 취소해도 돼요.", "If it rains a lot, we can cancel the appointment.", "취소해도 돼요"),
    line("시간이 있으면 카페에도 가요.", "If we have time, let's go to a cafe too.", "시간이 있으면"),
    line("배고프면 먼저 밥을 먹어요.", "If you're hungry, eat first.", "배고프면"),
    line("목마르면 물을 마셔요.", "If you're thirsty, drink water.", "목마르면"),
    line("피곤하면 집에서 쉬어도 돼요.", "If you're tired, you may rest at home.", "피곤하면"),
    line("길을 잃으면 저에게 연락해요.", "If you get lost, contact me.", "길을 잃으면"),
    line("필요하면 제가 도와줄게요.", "If needed, I'll help.", "필요하면"),
    line("밤에는 그 길이 조금 위험해요.", "At night that road is a little dangerous.", "위험해요"),
    line("그럼 안전한 길로 갈게요.", "Then I'll take the safe route.", "안전한 길")
  ]),
  lesson(45, "A2", "Going to Buy Tickets", "A learner explains intentions before moving.", ["-(으)려고 해요 intend/plan to", "Purpose before action"], [
    v("사려고 해요", "사다", "intend to buy", "phrase"), v("가려고 해요", "가다", "intend to go", "phrase"), v("먹으려고 해요", "먹다", "intend to eat", "phrase"), v("만나려고 해요", "만나다", "intend to meet", "phrase"), v("예약하려고 해요", "예약하다", "intend to reserve", "phrase"), v("배우려고 해요", "배우다", "intend to learn", "phrase"), v("쉬려고 해요", "쉬다", "intend to rest", "phrase"), v("출발해요", "출발하다", "depart", "verb"), v("도착 시간", "도착 시간", "arrival time", "noun"), v("행사", "행사", "event", "noun"), v("공연", "공연", "performance", "noun"), v("입장권", "입장권", "admission ticket", "noun"), v("온라인", "온라인", "online", "noun"), v("미리", "미리", "in advance", "adverb"), v("직접", "직접", "directly; in person", "adverb")
  ], [idiom("마음먹었어요", "I've made up my mind.", "Literally 'ate/took a heart.' Used when you decide firmly to do something.")], [18, 23, 33], [
    line("이번 주말에 공연을 보려고 해요.", "I'm planning to see a performance this weekend.", "보려고 해요"),
    line("입장권을 미리 사려고 해요.", "I intend to buy admission tickets in advance.", "사려고 해요"),
    line("온라인으로 예약하려고 해요?", "Do you plan to reserve online?", "예약하려고 해요"),
    line("아니요, 직접 가려고 해요.", "No, I plan to go in person.", "가려고 해요"),
    line("누구를 만나려고 해요?", "Who are you planning to meet?", "만나려고 해요"),
    line("수업 친구를 만나려고 해요.", "I'm planning to meet a class friend.", "만나려고 해요"),
    line("공연 전에 저녁을 먹으려고 해요.", "We plan to eat dinner before the performance.", "먹으려고 해요"),
    line("끝나고 바로 집에 가려고 해요.", "After it ends, I plan to go straight home.", "가려고 해요"),
    line("이번에는 꼭 한국 노래를 배우려고 마음먹었어요.", "This time I've made up my mind to learn a Korean song.", "마음먹었어요"),
    line("좋아요. 저도 같이 가려고 해요.", "Great. I plan to go too.", "가려고 해요")
  ]),
  lesson(46, "A2", "Doing Two Things at Once", "Friends describe multitasking and simultaneous actions.", ["-(으)면서 while doing", "Simultaneous compatible actions"], [
    v("걸으면서", "걷다", "while walking", "clause"), v("먹으면서", "먹다", "while eating", "clause"), v("마시면서", "마시다", "while drinking", "clause"), v("들으면서", "듣다", "while listening", "clause"), v("보면서", "보다", "while watching", "clause"), v("공부하면서", "공부하다", "while studying", "clause"), v("일하면서", "일하다", "while working", "clause"), v("기다리면서", "기다리다", "while waiting", "clause"), v("통화해요", "통화하다", "talk on the phone", "verb"), v("운전해요", "운전하다", "drive", "verb"), v("위험할 수 있어요", "위험하다", "can be dangerous", "phrase"), v("편안해요", "편안하다", "comfortable; peaceful", "adjective"), v("집중해요", "집중하다", "focus", "verb"), v("방해돼요", "방해되다", "be distracting", "verb"), v("헤드폰", "헤드폰", "headphones", "noun")
  ], [idiom("귀에 쏙쏙 들어와요", "It sinks in easily.", "Literally 'it comes right into the ears.' Used for clear explanations, catchy language, or audio that is easy to understand.")], [30, 31, 37], [
    line("저는 걸으면서 음악을 들어요.", "I listen to music while walking.", "걸으면서"),
    line("카페에서 커피를 마시면서 공부해요.", "I study while drinking coffee at a cafe.", "마시면서"),
    line("드라마를 보면서 한국어를 배워요.", "I learn Korean while watching dramas.", "보면서"),
    line("선생님 설명은 귀에 쏙쏙 들어와요.", "The teacher's explanation sinks in easily.", "귀에 쏙쏙 들어와요"),
    line("운전하면서 통화하면 위험해요.", "Talking on the phone while driving is dangerous.", "운전하면서"),
    line("일하면서 메시지를 보면 방해돼요.", "Looking at messages while working is distracting.", "일하면서"),
    line("기다리면서 책을 읽었어요.", "I read a book while waiting.", "기다리면서"),
    line("밥 먹으면서 뉴스 봐요?", "Do you watch the news while eating?", "먹으면서"),
    line("가끔요. 하지만 집중이 안 돼요.", "Sometimes. But I can't focus.", "집중"),
    line("그럼 조용히 먹으면서 쉬어요.", "Then eat quietly and rest.", "먹으면서")
  ]),
  lesson(47, "A2", "After Finishing", "A learner narrates completed steps.", ["-고 나서 after doing", "Clear sequence of completed actions"], [
    v("먹고 나서", "먹다", "after eating", "clause"), v("끝나고 나서", "끝나다", "after ending", "clause"), v("도착하고 나서", "도착하다", "after arriving", "clause"), v("확인하고 나서", "확인하다", "after checking", "clause"), v("씻고 나서", "씻다", "after washing", "clause"), v("정리하고 나서", "정리하다", "after organizing", "clause"), v("결정해요", "결정하다", "decide", "verb"), v("떠나요", "떠나다", "leave; depart", "verb"), v("신청해요", "신청하다", "apply; sign up", "verb"), v("완료", "완료", "completion", "noun"), v("확인 문자", "확인 문자", "confirmation text", "noun"), v("목록", "목록", "list", "noun"), v("차례", "차례", "turn; order", "noun"), v("마지막", "마지막", "last", "noun"), v("드디어", "드디어", "finally", "adverb")
  ], [idiom("마음이 놓여요", "I feel relieved.", "Literally 'my heart is put down.' Used when anxiety drops after confirmation or completion.")], [31, 32, 33], [
    line("아침을 먹고 나서 출발해요.", "After eating breakfast, I depart.", "먹고 나서"),
    line("역에 도착하고 나서 친구에게 연락해요.", "After arriving at the station, I contact my friend.", "도착하고 나서"),
    line("목록을 확인하고 나서 장을 봐요.", "After checking the list, I grocery shop.", "확인하고 나서"),
    line("수업이 끝나고 나서 복습해요.", "After class ends, I review.", "끝나고 나서"),
    line("방을 정리하고 나서 쉬어요.", "After tidying the room, I rest.", "정리하고 나서"),
    line("신청하고 나서 확인 문자가 왔어요.", "After I signed up, a confirmation text came.", "신청하고 나서"),
    line("드디어 완료됐네요.", "It's finally complete.", "완료됐네요"),
    line("이제 마음이 놓여요.", "Now I feel relieved.", "마음이 놓여요"),
    line("마지막 차례는 누구예요?", "Whose turn is last?", "마지막 차례"),
    line("제가 마지막이에요. 끝나고 나서 갈게요.", "I'm last. I'll go after it ends.", "끝나고 나서")
  ]),
  lesson(48, "A2", "It Seems Like Rain", "Friends make guesses softly.", ["-는 것 같아요 seems/looks like", "Softening opinions"], [
    v("비가 오는 것 같아요", "비가 오다", "it seems to be raining", "phrase"), v("좋은 것 같아요", "좋다", "seems good", "phrase"), v("맞는 것 같아요", "맞다", "seems right", "phrase"), v("아닌 것 같아요", "아니다", "doesn't seem so", "phrase"), v("바쁜 것 같아요", "바쁘다", "seems busy", "phrase"), v("아픈 것 같아요", "아프다", "seems sick", "phrase"), v("졸린 것 같아요", "졸리다", "seems sleepy", "phrase"), v("확실해요", "확실하다", "certain", "adjective"), v("아마도", "아마도", "probably", "adverb"), v("혹시", "혹시", "by any chance", "adverb"), v("감", "감", "sense; hunch", "noun"), v("소리", "소리", "sound", "noun"), v("냄새", "냄새", "smell", "noun"), v("표정", "표정", "facial expression", "noun"), v("조심스럽게", "조심스럽게", "carefully; cautiously", "adverb")
  ], [idiom("느낌이 와요", "I get a feeling; I can sense it.", "Literally 'a feeling comes.' Used when you intuit or sense something.")], [13, 22, 42], [
    line("밖에 비가 오는 것 같아요.", "It seems like it's raining outside.", "비가 오는 것 같아요"),
    line("소리가 들려요?", "Do you hear the sound?", "소리"),
    line("네, 창문 밖에서 빗소리가 나요.", "Yes, there's rain sound outside the window.", "소리가 나요"),
    line("민지 씨는 오늘 바쁜 것 같아요.", "Minji seems busy today.", "바쁜 것 같아요"),
    line("표정이 조금 피곤해 보여요.", "Her expression looks a little tired.", "표정"),
    line("리암 씨는 감기인 것 같아요?", "Does Liam seem to have a cold?", "감기인 것 같아요"),
    line("아마도요. 목소리가 아픈 것 같아요.", "Probably. His voice seems sick.", "아픈 것 같아요"),
    line("이 답이 맞는 것 같아요.", "This answer seems right.", "맞는 것 같아요"),
    line("확실하지 않으면 조심스럽게 말해요.", "If you're not sure, say it carefully.", "확실하지 않으면"),
    line("그래도 느낌이 와요. 이 길이 좋은 것 같아요.", "Still, I get a feeling. This route seems good.", "느낌이 와요")
  ]),
  lesson(49, "A2", "Is It Okay If I...?", "A guest asks permission politely.", ["-아/어도 돼요 may/is it okay to", "Permission and social softening"], [
    v("앉아도 돼요", "앉다", "may sit", "phrase"), v("먹어도 돼요", "먹다", "may eat", "phrase"), v("마셔도 돼요", "마시다", "may drink", "phrase"), v("사진 찍어도 돼요", "사진 찍다", "may take photos", "phrase"), v("열어도 돼요", "열다", "may open", "phrase"), v("써도 돼요", "쓰다", "may use", "phrase"), v("들어가도 돼요", "들어가다", "may enter", "phrase"), v("물어봐도 돼요", "물어보다", "may ask", "phrase"), v("잠깐", "잠깐", "briefly", "adverb"), v("실례지만", "실례지만", "excuse me, but", "discourse marker"), v("허락", "허락", "permission", "noun"), v("규칙", "규칙", "rule", "noun"), v("가능하면", "가능하다", "if possible", "clause"), v("조용히", "조용히", "quietly", "adverb"), v("마음껏", "마음껏", "as much as you like", "adverb")
  ], [idiom("마음껏 드세요", "Please eat as much as you like.", "마음껏 means 'to your heart's content.' A warm invitation, less stiff than a literal permission statement.")], [26, 33, 44], [
    line("여기 앉아도 돼요?", "May I sit here?", "앉아도 돼요"),
    line("네, 앉아도 돼요.", "Yes, you may sit.", "앉아도 돼요"),
    line("혹시 물 좀 마셔도 돼요?", "By any chance, may I drink some water?", "마셔도 돼요"),
    line("그럼요. 마음껏 드세요.", "Of course. Please have as much as you like.", "마음껏 드세요"),
    line("창문을 열어도 돼요?", "May I open the window?", "열어도 돼요"),
    line("네, 하지만 조용히 열어 주세요.", "Yes, but please open it quietly.", "열어 주세요"),
    line("여기서 사진 찍어도 돼요?", "May I take photos here?", "사진 찍어도 돼요"),
    line("규칙 때문에 안 돼요.", "Because of the rules, you can't.", "안 돼요"),
    line("그럼 질문 하나 물어봐도 돼요?", "Then may I ask one question?", "물어봐도 돼요"),
    line("네, 가능하면 짧게 해 주세요.", "Yes, if possible, please keep it short.", "가능하면")
  ]),
  lesson(50, "A2", "You Must Not", "A guide explains prohibitions kindly.", ["-(으)면 안 돼요 must not", "Public rules"], [
    v("들어가면 안 돼요", "들어가다", "must not enter", "phrase"), v("먹으면 안 돼요", "먹다", "must not eat", "phrase"), v("마시면 안 돼요", "마시다", "must not drink", "phrase"), v("찍으면 안 돼요", "찍다", "must not take photos", "phrase"), v("만지면 안 돼요", "만지다", "must not touch", "phrase"), v("떠들면 안 돼요", "떠들다", "must not be loud", "phrase"), v("늦으면 안 돼요", "늦다", "must not be late", "phrase"), v("박물관", "박물관", "museum", "noun"), v("전시", "전시", "exhibition", "noun"), v("작품", "작품", "artwork; piece", "noun"), v("안내", "안내", "guidance; information", "noun"), v("표지판", "표지판", "sign", "noun"), v("조용해야 해요", "조용하다", "have to be quiet", "phrase"), v("규칙을 지켜요", "규칙을 지키다", "follow rules", "phrase"), v("벌금", "벌금", "fine; penalty", "noun")
  ], [idiom("선을 넘으면 안 돼요", "Don't cross the line.", "Literally and figuratively 'must not cross the line.' Here used for a museum boundary line; also common for behavior limits.")], [26, 44, 49], [
    line("박물관에서는 조용해야 해요.", "In the museum, we have to be quiet.", "조용해야 해요"),
    line("이 전시실에는 들어가면 안 돼요.", "You must not enter this exhibition room.", "들어가면 안 돼요"),
    line("작품을 만지면 안 돼요.", "You must not touch the artwork.", "만지면 안 돼요"),
    line("사진을 찍으면 안 돼요?", "May we not take photos?", "찍으면 안 돼요"),
    line("네, 표지판을 보세요.", "Right, look at the sign.", "표지판"),
    line("여기서 먹거나 마시면 안 돼요.", "You must not eat or drink here.", "마시면 안 돼요"),
    line("아이들이 떠들면 안 돼요.", "Children must not be noisy.", "떠들면 안 돼요"),
    line("안내 시간에 늦으면 안 돼요.", "You must not be late for the guide time.", "늦으면 안 돼요"),
    line("선을 넘으면 안 돼요.", "Don't cross the line.", "선을 넘으면 안 돼요"),
    line("규칙을 지키면 모두 편해요.", "If we follow the rules, everyone is comfortable.", "규칙을 지키면")
  ]),
  lesson(51, "A2", "Shall We...?", "Friends make and respond to suggestions.", ["-(으)ㄹ까요? shall/should we", "Soft offers and guesses"], [
    v("갈까요", "가다", "shall we go?", "phrase"), v("먹을까요", "먹다", "shall we eat?", "phrase"), v("마실까요", "마시다", "shall we drink?", "phrase"), v("볼까요", "보다", "shall we watch/look?", "phrase"), v("앉을까요", "앉다", "shall we sit?", "phrase"), v("기다릴까요", "기다리다", "shall we wait?", "phrase"), v("도와드릴까요", "도와드리다", "shall I help?", "phrase"), v("시킬까요", "시키다", "shall we order?", "phrase"), v("나눌까요", "나누다", "shall we share?", "phrase"), v("정할까요", "정하다", "shall we decide?", "phrase"), v("일단", "일단", "first; for now", "adverb"), v("잠깐만", "잠깐만", "hold on a moment", "phrase"), v("메뉴판", "메뉴판", "menu board", "noun"), v("추천 메뉴", "추천 메뉴", "recommended menu", "noun"), v("각자", "각자", "each person", "noun")
  ], [idiom("어떻게 할까요?", "What should we do?", "Literally 'how shall we do?' Very common for deciding next steps together.")], [11, 25, 49], [
    line("점심은 어디서 먹을까요?", "Where shall we eat lunch?", "먹을까요"),
    line("사람이 많으니까 먼저 앉을까요?", "Since there are many people, shall we sit first?", "앉을까요"),
    line("메뉴판을 볼까요?", "Shall we look at the menu?", "볼까요"),
    line("추천 메뉴를 시킬까요?", "Shall we order the recommended menu?", "시킬까요"),
    line("비빔밥 하나를 나눌까요?", "Shall we share one bibimbap?", "나눌까요"),
    line("아니면 각자 주문할까요?", "Or shall each of us order?", "주문할까요"),
    line("음, 어떻게 할까요?", "Hmm, what should we do?", "어떻게 할까요"),
    line("제가 도와드릴까요?", "Shall I help?", "도와드릴까요"),
    line("잠시 기다릴까요? 친구가 오고 있어요.", "Shall we wait a moment? A friend is coming.", "기다릴까요"),
    line("좋아요. 음료는 나중에 정할까요?", "Good. Shall we decide drinks later?", "정할까요")
  ]),
  lesson(52, "A2", "Could You Help Me?", "A learner asks for small favors in natural spoken Korean.", ["-아/어 주세요 please do", "-아/어 주실래요? would you"], [
    v("도와주세요", "도와주다", "please help", "verb"), v("알려 주세요", "알려 주다", "please tell", "phrase"), v("보여 주세요", "보여 주다", "please show", "phrase"), v("빌려 주세요", "빌려 주다", "please lend", "phrase"), v("기다려 주세요", "기다려 주다", "please wait", "phrase"), v("열어 주세요", "열어 주다", "please open", "phrase"), v("닫아 주세요", "닫아 주다", "please close", "phrase"), v("추천해 주세요", "추천해 주다", "please recommend", "phrase"), v("설명해 주세요", "설명해 주다", "please explain", "phrase"), v("천천히 말해 주세요", "천천히 말해 주다", "please speak slowly", "phrase"), v("문법", "문법", "grammar", "noun"), v("단어", "단어", "word; vocabulary", "noun"), v("뜻", "뜻", "meaning", "noun"), v("예문", "예문", "example sentence", "noun"), v("발표 자료", "발표 자료", "presentation materials", "noun")
  ], [idiom("한번 봐 주세요", "Please take a quick look.", "Literally 'please look once.' A natural soft request for checking something, not only looking one time.")], [14, 26, 51], [
    line("선생님, 이 문법을 설명해 주세요.", "Teacher, please explain this grammar.", "설명해 주세요"),
    line("단어 뜻도 알려 주세요.", "Please tell me the word meaning too.", "알려 주세요"),
    line("예문을 보여 주세요.", "Please show me an example sentence.", "보여 주세요"),
    line("조금 천천히 말해 주세요.", "Please speak a little slowly.", "말해 주세요"),
    line("친구야, 펜 좀 빌려 주세요.", "Friend, please lend me a pen.", "빌려 주세요"),
    line("문을 열어 주세요.", "Please open the door.", "열어 주세요"),
    line("창문은 닫아 주세요.", "Please close the window.", "닫아 주세요"),
    line("좋은 식당을 추천해 주세요.", "Please recommend a good restaurant.", "추천해 주세요"),
    line("발표 자료를 한번 봐 주세요.", "Please take a quick look at my presentation materials.", "한번 봐 주세요"),
    line("네, 제가 도와줄게요.", "Yes, I'll help.", "도와줄게요")
  ]),
  lesson(53, "A2", "Have You Ever...?", "Friends compare life experiences.", ["-(으)ㄴ 적이 있어요 have ever", "아직 ... 적이 없어요"], [
    v("가 본 적이 있어요", "가 보다", "have been", "phrase"), v("먹어 본 적이 있어요", "먹어 보다", "have tried eating", "phrase"), v("만나 본 적이 있어요", "만나 보다", "have met", "phrase"), v("타 본 적이 있어요", "타 보다", "have ridden", "phrase"), v("해 본 적이 있어요", "해 보다", "have tried doing", "phrase"), v("본 적이 없어요", "보다", "have never seen", "phrase"), v("여태", "여태", "until now; yet", "adverb"), v("한 번", "한 번", "once", "phrase"), v("여러 번", "여러 번", "several times", "phrase"), v("제주도", "제주도", "Jeju Island", "noun"), v("부산", "부산", "Busan", "noun"), v("한강", "한강", "Han River", "noun"), v("한복", "한복", "hanbok", "noun"), v("축제", "축제", "festival", "noun"), v("경험", "경험", "experience", "noun")
  ], [idiom("꿈만 같아요", "It feels like a dream.", "Literally 'it is like only a dream.' Used for wonderful or unreal-feeling experiences.")], [21, 27, 45], [
    line("제주도에 가 본 적이 있어요?", "Have you ever been to Jeju Island?", "가 본 적이 있어요"),
    line("아니요, 아직 가 본 적이 없어요.", "No, I haven't been yet.", "적이 없어요"),
    line("부산은 한 번 가 본 적이 있어요.", "I've been to Busan once.", "한 번"),
    line("한강에서 자전거 타 본 적이 있어요?", "Have you ever ridden a bike at the Han River?", "타 본 적이 있어요"),
    line("네, 여러 번 타 봤어요.", "Yes, I've ridden several times.", "여러 번"),
    line("한복 입어 본 적이 있어요?", "Have you ever worn hanbok?", "입어 본 적이 있어요"),
    line("축제에서 입어 봤어요. 꿈만 같았어요.", "I tried it at a festival. It felt like a dream.", "꿈만 같았어요"),
    line("불고기는 먹어 본 적이 있죠?", "You've tried bulgogi, right?", "먹어 본 적"),
    line("물론이죠. 제 입에 맞아요.", "Of course. It suits my taste.", "입에 맞아요"),
    line("좋은 경험이 많네요.", "You have lots of good experiences.", "경험")
  ]),
  lesson(54, "A2", "I'll Do It", "Friends make promises and volunteer actions.", ["-(으)ㄹ게요 speaker's promise", "Distinguishing will from plan"], [
    v("할게요", "하다", "I'll do it", "phrase"), v("갈게요", "가다", "I'll go", "phrase"), v("볼게요", "보다", "I'll look/watch", "phrase"), v("살게요", "사다", "I'll buy", "phrase"), v("가져올게요", "가져오다", "I'll bring", "phrase"), v("보낼게요", "보내다", "I'll send", "phrase"), v("전화할게요", "전화하다", "I'll call", "phrase"), v("기다릴게요", "기다리다", "I'll wait", "phrase"), v("도와줄게요", "도와주다", "I'll help", "phrase"), v("약속할게요", "약속하다", "I promise", "phrase"), v("제가", "제가", "I (subject, polite)", "pronoun"), v("대신", "대신", "instead; in place of", "noun"), v("확실히", "확실히", "for sure", "adverb"), v("바로", "바로", "right away", "adverb"), v("늦지 않게", "늦지 않다", "so as not to be late", "phrase")
  ], [idiom("제가 할게요", "I'll take care of it.", "Literally 'I will do it.' As a set response, it volunteers responsibility in a warm, practical way.")], [23, 29, 52], [
    line("누가 발표 자료를 보낼까요?", "Who will send the presentation materials?", "보낼까요"),
    line("제가 할게요.", "I'll take care of it.", "제가 할게요"),
    line("그럼 저는 음료를 살게요.", "Then I'll buy drinks.", "살게요"),
    line("제가 충전기를 가져올게요.", "I'll bring the charger.", "가져올게요"),
    line("민지 씨에게 바로 전화할게요.", "I'll call Minji right away.", "전화할게요"),
    line("저는 역에서 기다릴게요.", "I'll wait at the station.", "기다릴게요"),
    line("늦지 않게 갈게요.", "I'll go so I'm not late.", "갈게요"),
    line("문제가 있으면 제가 도와줄게요.", "If there's a problem, I'll help.", "도와줄게요"),
    line("확실히 확인해 볼게요.", "I'll check for sure.", "볼게요"),
    line("고마워요. 저도 약속할게요.", "Thanks. I promise too.", "약속할게요")
  ]),
  lesson(55, "A2", "A Short Past Story", "A learner narrates a small travel problem.", ["Past narrative with connectors", "때 when/during"], [
    v("그때", "그때", "at that time", "noun"), v("여행했어요", "여행하다", "traveled", "verb"), v("도착했어요", "도착하다", "arrived", "verb"), v("출발했어요", "출발하다", "departed", "verb"), v("잃어버렸어요", "잃어버리다", "lost", "verb"), v("찾았어요", "찾다", "found; searched", "verb"), v("여쭤봤어요", "여쭤보다", "asked politely", "verb"), v("알려 줬어요", "알려 주다", "told; let know", "phrase"), v("도와줬어요", "도와주다", "helped", "phrase"), v("갑자기", "갑자기", "suddenly", "adverb"), v("결국", "결국", "eventually", "adverb"), v("다행히", "다행히", "fortunately", "adverb"), v("불안했어요", "불안하다", "was anxious", "adjective"), v("안심했어요", "안심하다", "felt relieved", "verb"), v("이야기해요", "이야기하다", "tell a story", "verb")
  ], [idiom("큰일 날 뻔했어요", "That was almost a disaster.", "Literally 'a big thing almost happened.' Used when something bad nearly happened but was avoided.")], [21, 44, 47], [
    line("지난주에 부산으로 여행했어요.", "Last week I traveled to Busan.", "여행했어요"),
    line("아침 일찍 출발했어요.", "I departed early in the morning.", "출발했어요"),
    line("역에 도착했을 때 표를 잃어버렸어요.", "When I arrived at the station, I lost my ticket.", "도착했을 때"),
    line("갑자기 너무 불안했어요.", "Suddenly I was very anxious.", "불안했어요"),
    line("직원에게 물어봤어요.", "I asked a staff member.", "물어봤어요"),
    line("직원이 방법을 알려 줬어요.", "The staff member told me what to do.", "알려 줬어요"),
    line("친구도 옆에서 도와줬어요.", "My friend helped beside me too.", "도와줬어요"),
    line("다행히 표를 다시 찾았어요.", "Fortunately, I found the ticket again.", "찾았어요"),
    line("큰일 날 뻔했어요.", "That was almost a disaster.", "큰일 날 뻔했어요"),
    line("결국 여행은 정말 재미있었어요.", "In the end, the trip was really fun.", "재미있었어요")
  ]),
  lesson(56, "A2", "A Phone Call", "A learner handles a polite phone call and voicemail-like turns.", ["Phone openings with 여보세요", "Speaking to unavailable people"], [
    v("여보세요", "여보세요", "hello on the phone", "interjection"), v("통화 가능하세요", "통화 가능하다", "are you available to talk?", "phrase"), v("전화 받으세요", "전화를 받다", "answer the phone", "phrase"), v("전화 드렸어요", "전화 드리다", "called you", "phrase"), v("부재중 전화", "부재중 전화", "missed call", "noun"), v("메시지를 남겨요", "메시지를 남기다", "leave a message", "phrase"), v("다시 걸게요", "다시 걸다", "I'll call again", "phrase"), v("연결", "연결", "connection", "noun"), v("끊겨요", "끊기다", "get disconnected", "verb"), v("소리가 작아요", "소리가 작다", "the sound is low", "phrase"), v("잘 안 들려요", "잘 안 들리다", "I can't hear well", "phrase"), v("잠시 후", "잠시 후", "after a moment", "noun"), v("담당자", "담당자", "person in charge", "noun"), v("문의", "문의", "inquiry", "noun"), v("성함", "성함", "name (honorific)", "noun")
  ], [idiom("잘 안 들려요", "I can't hear you well.", "Literally 'it isn't heard well.' The standard phone phrase when audio is unclear.")], [26, 33, 54], [
    line("여보세요? 민지 씨 통화 가능하세요?", "Hello? Minji, are you available to talk?", "통화 가능하세요"),
    line("네, 그런데 소리가 조금 작아요.", "Yes, but the sound is a little low.", "소리가 조금 작아요"),
    line("아, 잘 안 들려요?", "Oh, you can't hear me well?", "잘 안 들려요"),
    line("네, 연결이 자꾸 끊겨요.", "Yes, the connection keeps cutting out.", "끊겨요"),
    line("그럼 제가 다시 걸게요.", "Then I'll call again.", "다시 걸게요"),
    line("부재중 전화가 있었어요.", "There was a missed call.", "부재중 전화"),
    line("제가 메시지를 남겼어요.", "I left a message.", "메시지를 남겼어요"),
    line("문의 담당자 성함이 뭐예요?", "What is the inquiry contact person's name?", "성함"),
    line("잠시 후에 전화 드릴게요.", "I'll call you after a moment.", "전화 드릴게요"),
    line("네, 전화 받아 주세요.", "Okay, please answer the phone.", "전화 받아 주세요")
  ]),
  lesson(57, "A2", "First Day at Work", "A beginner handles basic office and school-workplace language.", ["Formal workplace nouns with polite endings", "Requests plus sequence"], [
    v("출근해요", "출근하다", "go to work", "verb"), v("퇴근해요", "퇴근하다", "leave work", "verb"), v("동료", "동료", "coworker", "noun"), v("팀장님", "팀장님", "team leader", "noun"), v("회의실", "회의실", "meeting room", "noun"), v("자료를 준비해요", "자료를 준비하다", "prepare materials", "phrase"), v("이메일", "이메일", "email", "noun"), v("전송해요", "전송하다", "send electronically", "verb"), v("확인 부탁드려요", "확인 부탁드리다", "please check", "phrase"), v("복사해요", "복사하다", "copy", "verb"), v("프린트해요", "프린트하다", "print", "verb"), v("파일", "파일", "file", "noun"), v("마감", "마감", "deadline", "noun"), v("업무", "업무", "work tasks", "noun"), v("적응해요", "적응하다", "adjust; adapt", "verb")
  ], [idiom("눈코 뜰 새 없어요", "I'm incredibly busy.", "Literally 'no time to open eyes and nose.' Common vivid phrase for being swamped.")], [29, 52, 56], [
    line("오늘 첫 출근이에요.", "Today is my first day at work.", "첫 출근"),
    line("팀장님께 인사드렸어요.", "I greeted the team leader.", "인사드렸어요"),
    line("동료들이 정말 친절해요.", "My coworkers are really kind.", "동료들"),
    line("회의실은 어디에 있어요?", "Where is the meeting room?", "회의실"),
    line("자료를 준비하고 나서 회의실로 오세요.", "After preparing the materials, come to the meeting room.", "준비하고 나서"),
    line("이 파일을 프린트해 주세요.", "Please print this file.", "프린트해 주세요"),
    line("이메일로 보내도 돼요?", "May I send it by email?", "보내도 돼요"),
    line("네, 보내고 확인 부탁드려요.", "Yes, send it and please check.", "확인 부탁드려요"),
    line("마감 때문에 눈코 뜰 새 없어요.", "Because of the deadline, I'm incredibly busy.", "눈코 뜰 새 없어요"),
    line("그래도 천천히 업무에 적응하고 있어요.", "Still, I'm slowly adjusting to the work.", "적응하고 있어요")
  ]),
  lesson(58, "A2", "Dinner Invitation", "A learner accepts and responds to a home invitation.", ["Invitation responses", "Food courtesy set phrases"], [
    v("초대해요", "초대하다", "invite", "verb"), v("초대받았어요", "초대받다", "was invited", "verb"), v("방문해요", "방문하다", "visit", "verb"), v("선물", "선물", "gift", "noun"), v("과일", "과일", "fruit", "noun"), v("케이크", "케이크", "cake", "noun"), v("가지고 왔어요", "가지고 오다", "brought", "phrase"), v("차려요", "차리다", "set; prepare a meal", "verb"), v("드시다", "드시다", "eat/drink (honorific)", "verb"), v("잘 먹겠습니다", "잘 먹겠습니다", "thank you for the meal before eating", "phrase"), v("잘 먹었습니다", "잘 먹었습니다", "thank you for the meal after eating", "phrase"), v("맛있게 드세요", "맛있게 드세요", "enjoy your meal", "phrase"), v("덕분에", "덕분에", "thanks to", "noun"), v("배불러요", "배부르다", "am full", "adjective"), v("정성", "정성", "care; heartfelt effort", "noun")
  ], [idiom("잘 먹겠습니다", "Thank you for the meal.", "Literally 'I will eat well.' Said before eating to show gratitude to the cook/host or for the food.")], [10, 27, 49], [
    line("오늘 저녁에 집으로 초대받았어요.", "I was invited to someone's home for dinner tonight.", "초대받았어요"),
    line("빈손으로 가면 안 돼서 과일을 샀어요.", "I shouldn't go empty-handed, so I bought fruit.", "가면 안 돼서"),
    line("작은 케이크도 가지고 왔어요.", "I brought a small cake too.", "가지고 왔어요"),
    line("와 주셔서 고마워요.", "Thank you for coming.", "와 주셔서"),
    line("초대해 주셔서 감사합니다.", "Thank you for inviting me.", "초대해 주셔서"),
    line("음식을 많이 차렸네요.", "You prepared so much food.", "차렸네요"),
    line("맛있게 드세요.", "Enjoy your meal.", "맛있게 드세요"),
    line("잘 먹겠습니다.", "Thank you for the meal.", "잘 먹겠습니다"),
    line("정성이 느껴져요. 정말 맛있어요.", "I can feel the care. It's really delicious.", "정성이"),
    line("잘 먹었습니다. 덕분에 배불러요.", "Thank you for the meal. Thanks to you, I'm full.", "잘 먹었습니다")
  ]),
  lesson(59, "A2", "Weekend Trip Review", "Friends coordinate a complete short trip.", ["Integrated travel planning review", "Combining condition, intention, and sequence"], [
    v("일정", "일정", "schedule; itinerary", "noun"), v("숙소", "숙소", "lodging", "noun"), v("관광지", "관광지", "tourist site", "noun"), v("해변", "해변", "beach", "noun"), v("산", "산", "mountain", "noun"), v("지도 앱", "지도 앱", "map app", "noun"), v("길찾기", "길찾기", "route finding", "noun"), v("짐", "짐", "luggage", "noun"), v("챙겨요", "챙기다", "pack; take care of", "verb"), v("놓고 와요", "놓고 오다", "leave behind", "phrase"), v("도착하면", "도착하다", "when arriving", "clause"), v("출발 전에", "출발", "before departure", "phrase"), v("예매", "예매", "advance purchase/reservation", "noun"), v("취소표", "취소표", "canceled ticket", "noun"), v("사진을 남겨요", "사진을 남기다", "take/leave photos", "phrase")
  ], [idiom("발걸음이 가벼워요", "I feel light and excited to go.", "Literally 'my footsteps are light.' Used when leaving happily or with relief.")], [36, 44, 45, 47], [
    line("이번 주말 여행 일정 확인했어요?", "Did you check this weekend's trip itinerary?", "확인했어요"),
    line("네, 출발 전에 짐을 챙겨야 해요.", "Yes, before departure we have to pack.", "출발 전에"),
    line("여권을 놓고 오면 안 돼요.", "We must not leave the passport behind.", "놓고 오면 안 돼요"),
    line("기차표는 예매했어요?", "Did you reserve the train tickets?", "예매했어요"),
    line("아직요. 취소표가 있으면 사려고 해요.", "Not yet. If there's a canceled ticket, I plan to buy it.", "있으면"),
    line("숙소에 도착하면 먼저 체크인해요.", "When we arrive at the lodging, we'll check in first.", "도착하면"),
    line("그다음 관광지로 갈까요?", "After that, shall we go to the tourist site?", "갈까요"),
    line("해변보다 산이 더 좋아요.", "I like mountains more than beaches.", "해변보다 산이 더"),
    line("지도 앱으로 길찾기를 하면 편해요.", "If we use route finding in the map app, it's convenient.", "하면"),
    line("계획이 끝나니까 발걸음이 가벼워요.", "Now that planning is done, I feel light and excited.", "발걸음이 가벼워요")
  ]),
  lesson(60, "A2", "A2 Checkpoint: My Korean Week", "A learner tells a fuller story about study, friends, errands, and plans.", ["A0-A2 integrated spoken narrative", "Natural reactions, softeners, and recycling"], [
    v("이번 주", "이번 주", "this week", "noun"), v("지난달", "지난달", "last month", "noun"), v("늘", "늘", "always", "adverb"), v("조금씩", "조금씩", "little by little", "adverb"), v("자신감", "자신감", "confidence", "noun"), v("생겼어요", "생기다", "appeared; came about", "verb"), v("틀려도", "틀리다", "even if wrong", "clause"), v("괜찮다고", "괜찮다", "that it is okay", "clause"), v("느꼈어요", "느끼다", "felt", "verb"), v("도전", "도전", "challenge", "noun"), v("계속할 거예요", "계속하다", "will continue", "phrase"), v("목표", "목표", "goal", "noun"), v("자연스럽게", "자연스럽다", "naturally", "adverb"), v("대화", "대화", "conversation", "noun"), v("익숙해졌어요", "익숙해지다", "got used to", "verb")
  ], [idiom("입이 트였어요", "I started speaking more freely.", "Literally 'my mouth opened.' Used when language speaking ability begins to come out naturally.")], [20, 30, 42, 55], [
    line("이번 주에는 한국어를 많이 썼어요.", "This week I used Korean a lot.", "썼어요"),
    line("처음에는 말하는 것이 정말 어려웠어요.", "At first, speaking was really hard.", "말하는 것"),
    line("그런데 친구들이 틀려도 괜찮다고 했어요.", "But my friends said it's okay even if I make mistakes.", "괜찮다고 했어요"),
    line("그래서 조금씩 자신감이 생겼어요.", "So little by little I gained confidence.", "자신감이 생겼어요"),
    line("어제는 카페에서 자연스럽게 주문했어요.", "Yesterday I ordered naturally at a cafe.", "주문했어요"),
    line("직원이 빨리 말했지만 거의 이해했어요.", "The staff spoke quickly, but I understood almost everything.", "말했지만"),
    line("와, 이제 입이 트였네요.", "Wow, now you're starting to speak more freely.", "입이 트였네요"),
    line("아직 멀었지만 대화가 덜 무서워요.", "I still have far to go, but conversation is less scary.", "멀었지만"),
    line("다음 목표는 여행에서 길을 묻는 거예요.", "My next goal is asking directions while traveling.", "묻는 거예요"),
    line("좋아요. 저는 계속 도전할 거예요.", "Good. I'll keep challenging myself.", "도전할 거예요")
  ])
];

const extraSupport = [
  v("회사원", "회사원", "office worker", "noun"), v("맞아요", "맞다", "is right", "adjective"), v("이제", "이제", "now", "adverb"),
  v("두", "둘", "two", "number"), v("한", "하나", "one", "number"), v("반", "반", "half", "noun"), v("넣어요", "넣다", "put in", "verb"),
  v("타요", "타다", "ride", "verb"), v("여름", "여름", "summer", "noun"), v("소금", "소금", "salt", "noun"), v("사용해", "사용하다", "use", "verb"),
  v("만들", "만들다", "make", "verb"), v("끝낼", "끝내다", "finish", "verb"), v("들어", "듣다", "hear; listen", "verb"),
  v("신어요", "신다", "wear shoes", "verb"), v("가지고", "가지다", "have; carry", "verb"), v("손", "손", "hand", "noun"),
  v("소리", "소리", "sound", "noun"), v("답", "답", "answer", "noun"), v("멀었지만", "멀다", "is far but", "clause"), v("주문했어요", "주문하다", "ordered", "verb")
];

function curriculumFrom(specs) {
  return specs.map((spec) => ({
    lesson: spec.n,
    title: spec.title,
    situation: spec.situation,
    levelCheckpoint: spec.level,
    grammarPointsIntroduced: spec.grammarPoints,
    targetVocab: spec.vocab.map((item) => `${item.lemma}: ${item.meaning}`),
    targetIdiomsOrSetExpressions: spec.idioms.map((item) => ({
      surface: item.surface,
      meaning: item.meaning,
      explanation: item.explanation
    })),
    recyclesLessons: spec.recycle
  }));
}

function checkCurriculum(specs) {
  const grammar = new Set();
  const vocab = new Set();
  const idioms = new Set();
  for (const spec of specs) {
    if (spec.vocab.length < 15) throw new Error(`Lesson ${spec.n} has only ${spec.vocab.length} vocab items.`);
    if (spec.n >= 21 && spec.idioms.length < 1) throw new Error(`Lesson ${spec.n} needs an idiom.`);
    for (const point of spec.grammarPoints) {
      const key = point.toLocaleLowerCase();
      if (grammar.has(key)) throw new Error(`Duplicate grammar point: ${point}`);
      grammar.add(key);
    }
    for (const item of spec.vocab) {
      const key = item.surface.toLocaleLowerCase();
      if (vocab.has(key)) throw new Error(`Duplicate introduced vocab item: ${item.surface} in lesson ${spec.n}`);
      vocab.add(key);
    }
    for (const item of spec.idioms) {
      const key = item.surface.toLocaleLowerCase();
      if (idioms.has(key)) throw new Error(`Duplicate idiom: ${item.surface}`);
      idioms.add(key);
    }
    for (const previous of spec.recycle) {
      if (previous >= spec.n) throw new Error(`Lesson ${spec.n} recycles non-earlier lesson ${previous}.`);
    }
  }
}

function clean(value) {
  if (Array.isArray(value)) return value.map(clean).filter((item) => item !== undefined);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const next = clean(item);
      if (next !== undefined) out[key] = next;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof value === "string") return value.trim() ? value : undefined;
  return value === null ? undefined : value;
}

function wordsForSentence(sentence, vocabPool) {
  const words = [];
  const seen = new Set();
  for (const item of vocabPool) {
    const surfaces = item.surface.split("/");
    for (const surface of surfaces) {
      if (surface.length > 1 && sentence.text.includes(surface) && !seen.has(surface)) {
        seen.add(surface);
        words.push(clean({
          surface,
          lemma: item.lemma,
          meaning: item.meaning,
          role: item.role,
          explanation: item.explanation
        }));
        break;
      }
    }
  }
  return words;
}

function sentenceFrom(raw, spec, vocabPool) {
  const grammar = raw.grammarSurface ? [{
    pattern: spec.grammarPoints[0],
    surface: raw.grammarSurface,
    meaning: raw.translation,
    explanation: `${spec.grammarPoints[0]} is introduced here in a short spoken sentence. Notice how the Korean surface "${raw.grammarSurface}" carries the grammar while the English translation stays natural.`
  }] : undefined;
  const chunks = spec.idioms
    .filter((item) => raw.text.includes(item.surface))
    .map((item) => ({
      surface: item.surface,
      meaning: item.meaning,
      explanation: item.explanation,
      type: "idiom",
      level: spec.level,
      tags: ["common", "spoken"]
    }));
  return clean({
    text: raw.text,
    translation: raw.translation,
    words: wordsForSentence(raw, vocabPool),
    grammar,
    chunks
  });
}

function packEnvelope(lessonsForPack) {
  return clean({
    type: "fydor_pack",
    schemaVersion: 1,
    id: "korean-beginner-v1",
    title: "Korean Beginner Megapack: A0 to A2",
    description: "A complete Korean starter course for English speakers, moving from first greetings and Hangul-era survival phrases into A2 conversations about food, errands, travel, health, plans, and short past stories.",
    author: { name: "Fydor" },
    version: "1.0.0",
    license: "CC BY-NC-SA 4.0",
    language: "ko",
    baseLanguage: "en",
    level: "A0-A2",
    tags: ["korean", "beginner", "a0", "a1", "a2", "spoken", "textbook", "anki-style"],
    createdAt: now,
    updatedAt: now,
    lessons: lessonsForPack
  });
}

function buildLessons(count) {
  const built = [];
  let vocabPool = [...extraSupport];
  for (const spec of lessons.slice(0, count)) {
    vocabPool = [...vocabPool, ...spec.vocab];
    const sentences = spec.sentences.map((raw) => sentenceFrom(raw, spec, vocabPool));
    built.push(clean({
      language: "ko",
      baseLanguage: "en",
      title: `${String(spec.n).padStart(2, "0")} ${spec.title}`,
      description: `${spec.level} checkpoint: ${spec.situation}`,
      level: spec.level,
      tags: ["korean", spec.level.toLocaleLowerCase(), "beginner"],
      sentences
    }));
  }
  return built;
}

function validate() {
  const result = spawnSync(process.execPath, [validator, "packs/korean-beginner-v1.json"], {
    cwd: root,
    encoding: "utf8"
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`Validation failed with status ${result.status}.`);
}

checkCurriculum(lessons);
fs.writeFileSync(curriculumPath, JSON.stringify(curriculumFrom(lessons), null, 2) + "\n");

for (let count = 5; count <= lessons.length; count += 5) {
  fs.writeFileSync(packPath, JSON.stringify(packEnvelope(buildLessons(count)), null, 2) + "\n");
  console.log(`\nValidated chunk through lesson ${count}:`);
  validate();
}

console.log(`\nWrote ${packPath}`);
console.log(`Wrote ${curriculumPath}`);
