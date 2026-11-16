"use strict";
/* 학습 내용. 분류표의 꼬리표(id)는 기록과 이어져 있으므로 바꾸지 않고 추가만 한다. */
const D = (function(){
  const q = (ko, en) => ({ko, en});
  const TAGS = {
    g_sva: {k:"g", n:"3인칭 단수·수일치", why:"주어가 he, she, it이나 단수 명사(my son, my family, Nha Trang)이면 현재형 동사에 -s를 붙이고 do는 does, have는 has가 됩니다. 한국어에는 이 변화가 없어 가장 자주 빠집니다.", fix:"문장을 시작할 때 주어가 '하나'인지 먼저 확인하세요. 하나면 동사 끝에 s.",
      ex:["My family likes to travel.","My son doesn't have a swimming tube.","Nha Trang has beautiful beaches."],
      dr:[q("제 아내는 아이들을 가르칩니다.","My wife teaches children."),q("우리 교회는 주일에 예배가 세 번 있습니다.","Our church has three services on Sunday."),q("그는 영어를 잘하지 못합니다.","He doesn't speak English well."),q("제 첫째 아들은 수영을 좋아합니다.","My first son likes swimming."),q("하나님은 우리를 사랑하십니다.","God loves us."),q("이 버스는 시내로 갑니까?","Does this bus go downtown?")]},
    g_tense: {k:"g", n:"시제", why:"지난 일은 과거형으로 말합니다. last year, yesterday처럼 과거 시점을 말할 때는 have been이 아니라 과거형을 씁니다.", fix:"이야기를 시작할 때 '언제 일인가'를 먼저 정하고, 지난 일이면 동사를 모두 과거형으로 맞추세요.",
      ex:["We went to Vietnam last year.","The breakfast was wonderful.","I became a pastor ten years ago."],
      dr:[q("작년에 우리는 다낭에 갔습니다.","We went to Da Nang last year."),q("아이들은 수영을 정말 즐거워했습니다.","The kids really enjoyed swimming."),q("저는 대학생 때 예수님을 만났습니다.","I met Jesus when I was in college."),q("그 매니저가 우리에게 망고를 주었습니다.","The manager gave us mangoes."),q("어제는 비가 와서 집에 있었습니다.","It rained yesterday, so I stayed home."),q("저는 베트남에 두 번 가 봤습니다.","I have been to Vietnam twice.")]},
    g_art: {k:"g", n:"관사 (a, the)", why:"셀 수 있는 것 하나를 처음 말할 때는 a/an, 서로 아는 그것은 the를 붙입니다. 한국어에 없어서 빠뜨리기 쉽습니다.", fix:"명사를 말하기 직전에 '하나인가, 그것인가'를 떠올리세요.",
      ex:["I am a pastor.","We stayed at a resort.","The resort was near the beach."],
      dr:[q("저는 목사입니다.","I am a pastor."),q("질문이 하나 있습니다.","I have a question."),q("문 좀 열어 주시겠어요?","Could you open the door, please?"),q("우리는 해변 근처 호텔에 묵었습니다.","We stayed at a hotel near the beach."),q("성경을 함께 읽읍시다.","Let's read the Bible together."),q("한 시간 뒤에 만나요.","Let's meet in an hour.")]},
    g_prep: {k:"g", n:"전치사·짝 표현", why:"go on a trip, search for, listen to, pray for처럼 동사와 전치사는 한 덩어리입니다. 단어를 따로 옮기면 전치사가 빠집니다.", fix:"동사를 외울 때 뒤에 오는 전치사까지 한 덩어리로 외우세요.",
      ex:["We like to go on trips.","You can search for it on Google Maps.","I will pray for you."],
      dr:[q("우리는 여행 가는 것을 좋아합니다.","We like to go on trips."),q("당신을 위해 기도하겠습니다.","I will pray for you."),q("제 말을 들어 주세요.","Please listen to me."),q("저는 월요일에 도착했습니다.","I arrived on Monday."),q("저는 서울에서 태어났습니다.","I was born in Seoul."),q("저는 하나님을 믿습니다.","I believe in God.")]},
    g_plural: {k:"g", n:"복수형", why:"둘 이상이면 -s를 붙입니다. 어떤 종류 전체를 좋아한다고 말할 때도 복수로 말합니다(I like mangoes).", fix:"숫자나 many, some 뒤의 명사에는 s가 붙었는지 확인하세요.",
      ex:["I have two sons.","My kids love mangoes.","Many people came to the service."],
      dr:[q("저는 아들이 둘 있습니다.","I have two sons."),q("아이들은 망고를 좋아합니다.","My kids love mangoes."),q("많은 사람이 예배에 왔습니다.","Many people came to the service."),q("세 가지가 중요합니다.","Three things are important."),q("질문 있으신가요?","Do you have any questions?"),q("우리는 삼 일 동안 머물렀습니다.","We stayed for three days.")]},
    g_poss: {k:"g", n:"소유격·my 빠짐", why:"영어는 my, his, our를 거의 항상 붙입니다. '둘째 아이는'은 my second son, '아내 이름은'은 my wife's name입니다.", fix:"가족, 몸, 물건을 말할 때는 누구의 것인지 먼저 붙이세요.",
      ex:["My second son is seven.","My wife's name is Sarah.","He gave his life to God."],
      dr:[q("제 아내의 이름은 사라입니다.","My wife's name is Sarah."),q("둘째 아들은 일곱 살입니다.","My second son is seven years old."),q("손을 씻으세요.","Please wash your hands."),q("그는 자기 삶을 하나님께 드렸습니다.","He gave his life to God."),q("우리 교회는 서울 근처에 있습니다.","Our church is near Seoul."),q("제 생각을 나누고 싶습니다.","I want to share my thoughts.")]},
    g_order: {k:"g", n:"한국어식 어순", why:"한국어 순서 그대로 옮기면 'My family is four'가 됩니다. 영어는 '누가 → 한다 → 무엇을' 순서이고, 사람 수나 존재는 There is/are로 시작합니다.", fix:"말하기 전에 주어와 동사를 먼저 정하세요. 나머지는 뒤에 붙이면 됩니다.",
      ex:["There are four of us in my family.","My whole family loves mangoes.","I like Nha Trang more than Da Nang."],
      dr:[q("우리 가족은 네 명입니다.","There are four of us in my family."),q("저는 다낭보다 나트랑을 더 좋아합니다.","I like Nha Trang more than Da Nang."),q("우리 가족은 모두 망고를 좋아합니다.","My whole family loves mangoes."),q("저는 어제 교회에서 친구를 만났습니다.","I met a friend at church yesterday."),q("우리 교회에는 청년이 많습니다.","There are many young adults in our church."),q("저는 영어로 설교하고 싶습니다.","I want to preach in English.")]},
    g_be: {k:"g", n:"be동사·주어 누락", why:"영어 문장에는 주어와 동사가 꼭 있어야 합니다. 형용사나 명사 앞에는 be동사를 넣고, 날씨와 시간은 It으로 시작합니다.", fix:"한국어에서 생략한 '나는, 그것은'을 영어에서는 꼭 말하세요.",
      ex:["I am happy to be here.","It is hot today.","She is a teacher."],
      dr:[q("오늘 덥습니다.","It is hot today."),q("여기 와서 기쁩니다.","I am happy to be here."),q("그는 친절합니다.","He is kind."),q("배고프세요?","Are you hungry?"),q("늦어서 죄송합니다.","I am sorry I am late."),q("준비됐습니다.","I am ready.")]},
    g_comp: {k:"g", n:"비교 표현", why:"비교는 more 또는 -er 뒤에 than을 씁니다. 'like A than B'가 아니라 'like A more than B'입니다.", fix:"than이 나오면 그 앞에 more나 -er이 있는지 확인하세요.",
      ex:["I like Nha Trang more than Da Nang.","Nha Trang is cheaper than Da Nang.","This is better than I expected."],
      dr:[q("나트랑이 다낭보다 쌉니다.","Nha Trang is cheaper than Da Nang."),q("저는 커피보다 차를 더 좋아합니다.","I like tea more than coffee."),q("오늘이 어제보다 덥습니다.","Today is hotter than yesterday."),q("이것이 더 좋습니다.","This one is better."),q("기도가 걱정보다 낫습니다.","Praying is better than worrying."),q("그는 저보다 영어를 잘합니다.","He speaks English better than I do.")]},
    g_word: {k:"g", n:"어색한 표현", why:"한국어 표현을 단어 그대로 옮기면 어색해집니다(very wonderful, without others). 원어민이 실제로 쓰는 덩어리로 바꿔야 합니다.", fix:"교정받은 문장을 구문 은행에 담아 통째로 외우세요.",
      ex:["The food was really good.","He can swim without any help.","How have you been?"],
      dr:[q("음식이 정말 맛있었습니다.","The food was really good."),q("그는 도움 없이 수영할 수 있습니다.","He can swim without any help."),q("시간 좀 있으세요?","Do you have a minute?"),q("길을 잃었습니다.","I am lost."),q("그동안 잘 지내셨어요?","How have you been?"),q("수고하셨습니다.","Thank you for your hard work.")]},

    p_fp: {k:"p", n:"f 소리 (p처럼 들림)", why:"f는 윗니를 아랫입술에 살짝 대고 바람을 내보냅니다. 두 입술을 붙이면 p가 됩니다.", fix:"거울을 보고 윗니가 보이는지 확인하세요.",
      dr:[q("f마다 윗니를 아랫입술에","My family is full of faith."),q("first, found, friend","My first son found a friend."),q("fresh, fruit, five","Fresh fruit for five people."),q("forgive, forget","Forgive and forget."),q("feel, fine, festival","I feel fine after the festival.")]},
    p_vb: {k:"p", n:"v 소리 (b처럼 들림)", why:"v는 f와 같은 입 모양에서 목을 울립니다. 입술을 붙이면 b가 됩니다.", fix:"아랫입술이 떨리는 느낌이 나면 맞습니다.",
      dr:[q("love, visit, every, village","I love to visit every village."),q("gave, very, view","He gave us a very good view."),q("believe, victory","We believe in victory."),q("seven, vans, evening","Seven vans arrived in the evening."),q("have, lovely, vacation","Have a lovely vacation.")]},
    p_rl: {k:"p", n:"r과 l", why:"r은 혀끝이 입천장에 닿지 않게 뒤로 말고, l은 혀끝을 윗잇몸에 붙입니다.", fix:"r은 입술을 살짝 둥글게, l은 혀끝을 분명히 붙이세요.",
      dr:[q("really, like, river","I really like the river."),q("Lord, real","The Lord is real."),q("read, letter, slowly","Read the letter slowly."),q("right, left","Right or left? Turn right."),q("pray, world","Pray for the world.")]},
    p_th: {k:"p", n:"th 소리", why:"th는 혀끝을 윗니와 아랫니 사이에 살짝 내밉니다. the, than은 목을 울리고 think, three는 바람만 냅니다.", fix:"혀끝이 이 사이로 보일 만큼 내미세요.",
      dr:[q("think, this, third","I think this is the third one."),q("thank, these, three, things","Thank you for these three things."),q("brother, than","My brother is older than me."),q("with, faith, truth","With faith and truth."),q("they, gathered, together, Thursday","They gathered together on Thursday.")]},
    p_zj: {k:"p", n:"z 소리", why:"z는 s의 입 모양에서 목을 울립니다. '즈'가 아니라 벌이 우는 소리입니다.", fix:"s를 길게 내다가 목을 울려 보세요.",
      dr:[q("Jesus, amazing","Jesus is amazing."),q("please, close, eyes","Please close your eyes."),q("zoo, easy","The zoo is easy to find."),q("his, words, wise","His words are wise."),q("praise, his","We praise his name.")]},
    p_epen: {k:"p", n:"끝소리 뒤 모음 추가", why:"끝 자음 뒤에 '으'나 '이'를 붙이지 않습니다. trip은 '트립'이 아니라 한 박자이고, wife는 f에서 끝납니다.", fix:"끝 자음에서 소리를 멈추고 입을 그대로 두세요.",
      dr:[q("trip, last, week","We took a trip last week."),q("wife, bought, gift","My wife bought a gift."),q("stop, think","Stop and think."),q("like, church","I like the church."),q("good, night, sleep, tight","Good night and sleep tight.")]},
    p_vowel: {k:"p", n:"모음 구분", why:"짧은 i(live, ship)와 긴 ee(leave, sheep), a(man)와 e(men)를 구분해야 뜻이 바뀌지 않습니다.", fix:"긴 모음은 입을 옆으로 당겨 길게, 짧은 모음은 힘을 빼고 짧게.",
      dr:[q("live / leave","I live here, and I will leave tomorrow."),q("sheep / ship","The sheep are on the ship."),q("sit / seat","Sit in this seat."),q("man / men","The man met ten men."),q("full / fool","It is full, not a fool.")]},
    p_stress: {k:"p", n:"단어 강세", why:"단어마다 강하게 말하는 음절이 하나 있습니다. 그 음절은 높고 길게, 나머지는 약하게 말합니다.", fix:"새 단어는 강세 위치까지 함께 외우세요.",
      dr:[q("BEAU-ti-ful, va-CA-tion","It was a beautiful vacation."),q("re-MEM-ber, RES-tau-rant","I remember the restaurant."),q("im-POR-tant, de-CI-sion","This is an important decision."),q("COM-for-ta-ble, ho-TEL","We need a comfortable hotel."),q("en-COUR-age, to-GETH-er","Let's encourage one another together.")]},
    p_cluster: {k:"p", n:"자음이 겹칠 때", why:"sw, st, str, pl처럼 자음이 붙을 때 사이에 모음을 넣지 않습니다. swim은 '스윔'이 아니라 한 박자입니다.", fix:"첫 자음을 아주 짧게 내고 바로 다음 소리로 넘어가세요.",
      dr:[q("swim, swimming","We swim in the swimming pool."),q("stand, strong, stay, still","Stand strong and stay still."),q("please, play","Please play the piano."),q("street, straight","The street is straight."),q("Christ, strength","Christ is our strength.")]},
    p_final: {k:"p", n:"끝소리", why:"끝소리 t, d, k, s를 삼키지 않습니다. 과거형 -ed와 복수 -s가 들려야 뜻이 통합니다.", fix:"문장 끝 단어의 마지막 자음을 가볍게 터뜨리세요.",
      dr:[q("stayed, prayed","We stayed and prayed."),q("walked, talked","He walked and talked with us."),q("likes, books, cats","She likes books and cats."),q("asked, helped","I asked him and he helped me."),q("loved, world","God loved the world.")]},

    d_flat: {k:"d", n:"평평한 억양", why:"한국어는 높낮이 변화가 작아서 영어도 평평해지기 쉽습니다. 영어는 중요한 단어를 높고 길게 말해야 뜻이 전달됩니다.", fix:"문장마다 핵심 단어 하나를 골라 과장한다 싶을 만큼 올리세요.",
      dr:[q("really와 family를 높고 길게","I really love my family."),q("good과 all을 올려서","God is good all the time."),q("Vietnam과 last year를 올려서","We went to Vietnam last year."),q("most important를 강하게","This is the most important thing."),q("질문이니 끝을 올려서","Are you ready to worship?")]},
    d_pause: {k:"d", n:"잦은 멈춤", why:"단어마다 쉬면 듣는 사람이 뜻을 잇기 어렵습니다. 의미 덩어리 끝에서만 쉽니다.", fix:"말하기 전에 덩어리를 정하고, 한 덩어리는 한숨에 말하세요.",
      dr:[q("There are four of us / in my family.","There are four of us in my family."),q("I met Jesus / when I was in college.","I met Jesus when I was in college."),q("We stayed there / for three days.","We stayed there for three days."),q("Thank you / for coming today.","Thank you for coming today."),q("Let us pray / before we start.","Let us pray before we start.")]},
    d_filler: {k:"d", n:"군말 (uh, um)", why:"uh가 많으면 자신 없게 들립니다. 소리 없이 쉬는 편이 훨씬 유창하게 들립니다.", fix:"생각할 시간이 필요하면 아래 표현으로 시간을 버세요.",
      dr:[q("생각할 시간 벌기","Well, let me think about that."),q("질문을 받았을 때","That's a good question."),q("다시 설명할 때","What I mean is, God is faithful."),q("고쳐 말할 때","Let me say that again."),q("표현을 찾을 때","How can I put it? It was amazing.")]},
    d_slow: {k:"d", n:"느린 속도", why:"단어를 하나씩 만들어 말하면 느려집니다. 덩어리로 이어 말하면 속도가 붙습니다.", fix:"같은 문장을 세 번, 매번 조금 더 빠르게 말해 보세요.",
      dr:[q("한숨에 이어서","Nice to meet you. I'm a pastor from Korea."),q("한숨에 이어서","How long have you lived here?"),q("한숨에 이어서","Could you say that again, please?"),q("한숨에 이어서","I'm so glad to be here with you today."),q("한숨에 이어서","Let's pray together before we start.")]},
    d_ending: {k:"d", n:"습관적 끝맺음", why:"대답 끝마다 Thank you나 Okay를 붙이면 대화가 끊깁니다. 마지막 문장을 내려 말하면 끝났다는 신호가 됩니다.", fix:"마지막 문장 끝을 낮추고 잠깐 멈추세요. 필요하면 아래 표현으로 마무리합니다.",
      dr:[q("이야기를 마칠 때","So that's my family."),q("이유를 마칠 때","That's why I love it."),q("상대에게 넘길 때","How about you?"),q("설명을 마칠 때","I hope that makes sense.")]}
  };
  const TAG_IDS = Object.keys(TAGS);

  /* 영어 어순 원칙 7개 */
  const ORDER = [
    {id:"o_svo", t:"주어와 동사부터 말한다", d:"한국어는 동사가 끝에 오지만 영어는 '누가 + 한다'를 먼저 말하고 나머지를 붙입니다. 말할 내용이 떠오르면 주어와 동사부터 내뱉으세요.", ex:q("저는 매일 아침 성경을 읽습니다.","I read / the Bible / every morning."),
      dr:[q("저는 주일마다 설교합니다.","I preach every Sunday."),q("우리는 저녁을 같이 먹었습니다.","We had dinner together."),q("아내가 저를 많이 도와줍니다.","My wife helps me a lot."),q("아이들이 학교에서 영어를 배웁니다.","My kids learn English at school.")]},
    {id:"o_point", t:"결론 먼저, 이유는 뒤에", d:"한국어는 이유를 먼저 말하고 결론을 끝에 두지만, 영어는 결론을 먼저 말하고 because로 이유를 붙입니다.", ex:q("값이 싸고 수영을 많이 해서 나트랑이 더 좋았어요.","I liked Nha Trang more / because it was cheaper / and we swam a lot."),
      dr:[q("비가 와서 집에 있었어요.","I stayed home because it rained."),q("피곤해서 일찍 잤어요.","I went to bed early because I was tired."),q("그분이 친절해서 좋았어요.","I liked him because he was kind."),q("하나님이 저를 사랑하시니 두렵지 않습니다.","I am not afraid because God loves me.")]},
    {id:"o_after", t:"꾸미는 말은 뒤에 붙인다", d:"한국어는 꾸미는 말이 앞에 오지만('우리가 묵은 호텔'), 영어는 명사를 먼저 말하고 뒤에 설명을 붙입니다(the hotel / where we stayed).", ex:q("우리가 묵은 호텔","the hotel / where we stayed"),
      dr:[q("우리가 묵은 호텔은 좋았습니다.","The hotel where we stayed was nice."),q("제가 만난 사람은 선교사였습니다.","The man I met was a missionary."),q("쉴 시간이 필요합니다.","I need time to rest."),q("먹을 것이 있나요?","Is there anything to eat?")]},
    {id:"o_place", t:"장소 다음에 시간", d:"문장 끝의 순서는 '어디서 → 언제'입니다. 한국어의 '어제 교회에서'는 영어로 'at church yesterday'가 됩니다.", ex:q("어제 교회에서","at church / yesterday"),
      dr:[q("저는 어제 교회에서 그를 만났습니다.","I met him at church yesterday."),q("우리는 작년에 베트남에 갔습니다.","We went to Vietnam last year."),q("내일 아침에 여기서 만나요.","Let's meet here tomorrow morning."),q("저는 2010년에 서울에서 결혼했습니다.","I got married in Seoul in 2010.")]},
    {id:"o_there", t:"'있다'는 There is 또는 I have로", d:"'~이 있다'를 그대로 옮기지 않습니다. 어디에 무엇이 있으면 There is/are, 내가 가진 것이면 I have로 시작합니다.", ex:q("우리 가족은 네 명입니다.","There are four of us / in my family."),
      dr:[q("우리 교회에는 청년이 많습니다.","There are many young adults in our church."),q("저는 아들이 둘 있습니다.","I have two sons."),q("근처에 시장이 있나요?","Is there a market nearby?"),q("문제가 하나 있습니다.","There is a problem.")]},
    {id:"o_verb", t:"명사 대신 동사로 말한다", d:"한국어는 '~을 하다, ~이 되다'처럼 명사로 말하지만 영어는 동사 하나로 말하는 편이 자연스럽습니다(도움이 되었다 → helped).", ex:q("그 말씀이 큰 도움이 되었습니다.","That verse / helped me / a lot."),
      dr:[q("그 말씀이 저에게 큰 도움이 되었습니다.","That verse helped me a lot."),q("우리는 함께 기도를 했습니다.","We prayed together."),q("결정을 내려야 합니다.","I need to decide."),q("그 일로 제 생각이 바뀌었습니다.","That changed my mind.")]},
    {id:"o_short", t:"한 문장에 한 생각", d:"긴 문장을 만들다 멈추지 말고 짧은 문장 두세 개로 끊어 말하세요. and, so, but으로 이으면 충분합니다.", ex:q("저는 목사이고 아들이 둘 있으며 서울 근처에 삽니다.","I am a pastor. / I have two sons. / We live near Seoul."),
      dr:[q("저는 목사이고 아들이 둘 있으며 서울 근처에 삽니다.","I am a pastor. I have two sons. We live near Seoul."),q("어제는 피곤했지만 예배에 갔고 은혜를 받았습니다.","I was tired yesterday, but I went to the service. It really blessed me."),q("그는 친절해서 우리에게 망고를 주었습니다.","He was kind, so he gave us mangoes."),q("저는 영어가 아직 서툴지만 계속 연습하고 있습니다.","My English is not good yet, but I am working on it.")]}
  ];

  /* 구문 은행: [분류, 영어, 한국어] */
  const CATS = {daily:"일상·생활", keep:"대화 이어가기", story:"간증", gospel:"복음 전하기", worship:"예배 인도", prayer:"기도", sermon:"설교"};
  const P = [
    ["daily","Nice to meet you. I'm a pastor from Korea.","만나서 반갑습니다. 저는 한국에서 온 목사입니다."],
    ["daily","There are four of us in my family.","우리 가족은 네 명입니다."],
    ["daily","How long have you lived here?","여기서 얼마나 사셨어요?"],
    ["daily","Could you help me with this?","이것 좀 도와주시겠어요?"],
    ["daily","Where can I find a doctor?","의사를 어디서 만날 수 있나요?"],
    ["daily","How much is this?","이거 얼마예요?"],
    ["daily","I'm still learning English, so please speak slowly.","아직 영어를 배우는 중이라 천천히 말씀해 주세요."],
    ["daily","What do you do for a living?","무슨 일을 하세요?"],
    ["daily","I'd like to get to know you better.","당신을 더 알고 싶습니다."],
    ["daily","Would you like to come over for dinner?","저희 집에 저녁 드시러 오실래요?"],
    ["daily","Thank you for your help. I really appreciate it.","도와주셔서 감사합니다. 정말 고맙습니다."],
    ["daily","See you on Sunday.","주일에 봬요."],
    ["keep","Could you say that again, please?","다시 한번 말씀해 주시겠어요?"],
    ["keep","What does that word mean?","그 단어는 무슨 뜻인가요?"],
    ["keep","Let me think for a second.","잠깐 생각해 볼게요."],
    ["keep","What I mean is, God never gave up on me.","제 말은, 하나님이 저를 포기하지 않으셨다는 겁니다."],
    ["keep","How do you say this in English?","이건 영어로 어떻게 말하나요?"],
    ["keep","That's a good question.","좋은 질문이네요."],
    ["keep","I see what you mean.","무슨 말씀인지 알겠습니다."],
    ["keep","Sorry, I didn't catch that.","죄송해요, 잘 못 들었어요."],
    ["keep","How about you?","당신은 어떠세요?"],
    ["keep","Tell me more about that.","그 이야기 더 해 주세요."],
    ["keep","Let me say that again.","다시 말해 볼게요."],
    ["keep","That reminds me of something.","그 말을 들으니 생각나는 게 있어요."],
    ["story","I grew up in a Christian family.","저는 기독교 가정에서 자랐습니다."],
    ["story","I used to worry a lot, but now I trust God.","예전에는 걱정이 많았지만 지금은 하나님을 신뢰합니다."],
    ["story","When I was in college, I met Jesus personally.","대학생 때 예수님을 인격적으로 만났습니다."],
    ["story","That was the turning point of my life.","그것이 제 인생의 전환점이었습니다."],
    ["story","At that time, I was going through a hard time.","그때 저는 힘든 시기를 지나고 있었습니다."],
    ["story","God spoke to me through his word.","하나님께서 말씀으로 제게 말씀하셨습니다."],
    ["story","I realized that I couldn't do it on my own.","제 힘으로는 할 수 없다는 것을 깨달았습니다."],
    ["story","Since then, my life has changed.","그 이후로 제 삶이 달라졌습니다."],
    ["story","God has been faithful to my family.","하나님은 우리 가정에 신실하셨습니다."],
    ["story","I felt called to be a pastor.","목사로 부르심을 느꼈습니다."],
    ["story","Looking back, I can see God's hand in everything.","돌아보면 모든 일에 하나님의 손길이 보입니다."],
    ["story","I want to share what God has done in my life.","하나님이 제 삶에 하신 일을 나누고 싶습니다."],
    ["story","It wasn't easy, but God gave me strength.","쉽지 않았지만 하나님이 힘을 주셨습니다."],
    ["story","That's why I'm here today.","그래서 제가 오늘 여기 있습니다."],
    ["gospel","God loves you just as you are.","하나님은 있는 모습 그대로 당신을 사랑하십니다."],
    ["gospel","Jesus died for our sins and rose again.","예수님은 우리 죄를 위해 죽으시고 다시 살아나셨습니다."],
    ["gospel","We are saved by grace, not by what we do.","우리는 행위가 아니라 은혜로 구원받습니다."],
    ["gospel","Have you ever heard about Jesus?","예수님에 대해 들어 보신 적 있나요?"],
    ["gospel","May I share something with you?","한 가지 나눠도 될까요?"],
    ["gospel","God knows your name.","하나님은 당신의 이름을 아십니다."],
    ["gospel","You don't have to earn God's love.","하나님의 사랑은 노력해서 얻는 것이 아닙니다."],
    ["gospel","Would you like to pray with me?","저와 함께 기도하시겠어요?"],
    ["gospel","Jesus invites everyone who is tired to come to him.","예수님은 지친 모든 사람을 자기에게 오라고 부르십니다."],
    ["gospel","Nothing can separate us from God's love.","그 무엇도 우리를 하나님의 사랑에서 끊을 수 없습니다."],
    ["gospel","God has a plan for your life.","하나님은 당신의 삶을 향한 계획을 가지고 계십니다."],
    ["gospel","You are welcome at our church anytime.","우리 교회에 언제든 오세요."],
    ["worship","Good morning, and welcome to our worship service.","좋은 아침입니다. 예배에 오신 것을 환영합니다."],
    ["worship","Let us stand and worship the Lord together.","일어나 함께 주님을 예배합시다."],
    ["worship","Please be seated.","자리에 앉아 주십시오."],
    ["worship","Let us pray.","기도합시다."],
    ["worship","Let's open our Bibles to John chapter three.","요한복음 3장을 펴겠습니다."],
    ["worship","Let's read today's passage together.","오늘 본문을 함께 읽겠습니다."],
    ["worship","Please greet the people around you.","옆에 계신 분들과 인사를 나누세요."],
    ["worship","If you are new here, we are so glad you came.","처음 오신 분들, 와 주셔서 정말 기쁩니다."],
    ["worship","Let us quiet our hearts before God.","하나님 앞에 마음을 고요히 합시다."],
    ["worship","We will now receive the offering.","이제 헌금 시간을 갖겠습니다."],
    ["worship","Let's sing this song once more.","이 찬양을 한 번 더 부르겠습니다."],
    ["worship","Please join me in the Lord's Prayer.","주기도문으로 함께 기도하겠습니다."],
    ["worship","Go in peace, and may God bless you this week.","평안히 가십시오. 이번 주도 하나님이 복 주시기를 빕니다."],
    ["worship","Here are a few announcements.","몇 가지 광고가 있습니다."],
    ["prayer","Heavenly Father, we thank you for this day.","하늘 아버지, 오늘을 주셔서 감사합니다."],
    ["prayer","Thank you for your love that never fails.","변함없는 사랑에 감사드립니다."],
    ["prayer","Lord, please forgive our sins.","주님, 우리 죄를 용서해 주소서."],
    ["prayer","Please be with those who are sick.","아픈 이들과 함께해 주소서."],
    ["prayer","Give us wisdom and strength for today.","오늘을 위한 지혜와 힘을 주소서."],
    ["prayer","Open our hearts to hear your word.","말씀을 듣도록 우리 마음을 열어 주소서."],
    ["prayer","Thank you, Lord, for this food.","주님, 이 음식을 주셔서 감사합니다."],
    ["prayer","Please bless this family.","이 가정을 축복해 주소서."],
    ["prayer","Lord, we need you.","주님, 우리는 주님이 필요합니다."],
    ["prayer","Help us to love one another.","서로 사랑하게 도와주소서."],
    ["prayer","We trust you with everything.","모든 것을 주님께 맡깁니다."],
    ["prayer","In Jesus' name we pray. Amen.","예수님의 이름으로 기도합니다. 아멘."],
    ["sermon","Today I want to talk about God's grace.","오늘은 하나님의 은혜에 대해 말씀드리려 합니다."],
    ["sermon","Let me begin with a story.","이야기 하나로 시작하겠습니다."],
    ["sermon","Let's look at verse sixteen.","16절을 보겠습니다."],
    ["sermon","What does this mean for us today?","이것이 오늘 우리에게 무슨 의미일까요?"],
    ["sermon","The first thing we see is this.","첫째로 볼 것은 이것입니다."],
    ["sermon","In other words, God loved us first.","다시 말해, 하나님이 먼저 우리를 사랑하셨습니다."],
    ["sermon","Notice what the text says.","본문이 무엇이라 말하는지 보십시오."],
    ["sermon","Let me give you an example.","예를 하나 들겠습니다."],
    ["sermon","This is the heart of the gospel.","이것이 복음의 핵심입니다."],
    ["sermon","Some of you may be wondering why.","왜 그런지 궁금한 분도 계실 겁니다."],
    ["sermon","Here is the good news.","여기 좋은 소식이 있습니다."],
    ["sermon","So how should we respond?","그러면 우리는 어떻게 응답해야 할까요?"],
    ["sermon","Let me close with this thought.","이 말씀으로 마무리하겠습니다."],
    ["sermon","May this truth stay with you this week.","이 진리가 한 주간 여러분과 함께하기를 바랍니다."]
  ];
  const cnt = {};
  const PHRASES = P.map(function(r){ cnt[r[0]] = (cnt[r[0]]||0)+1; return {id:r[0]+cnt[r[0]], c:r[0], en:r[1], ko:r[2]}; });

  const SCENES = [
    {id:"daily", name:"일상 대화", open:"Hi! I'm glad to practice English with you. Tell me about your family. Who do you live with, and what do you like to do together?"},
    {id:"life", name:"선교지 생활 소통", open:"Let's practice daily life on the mission field. Imagine you have just moved to a new town. I am your new neighbor. Please introduce yourself and ask me for something you need."},
    {id:"testimony", name:"간증 나누기", open:"I would love to hear your story. How did you come to know Jesus? Take your time and tell me in your own words."},
    {id:"gospel", name:"복음 전하기", open:"Imagine I have never been to church, and I ask you: Why do you believe in God? Please answer me simply."},
    {id:"worship", name:"예배 인도", open:"Let's practice leading worship in English. Please welcome the congregation and invite them to worship, as if the service is starting right now."},
    {id:"sermon", name:"설교 연습", open:"Let's practice preaching. Choose one Bible verse you love, and explain it to me as if I have never heard the gospel."},
    {id:"read", name:"원고 낭독 코칭", open:"Please read your text aloud, clearly and naturally. I will listen to your pronunciation and intonation.", script:true},
    {id:"free", name:"자유 주제", open:"Hello! What would you like to talk about today?"},
    {id:"today", name:"오늘 하루 세 문장", open:"Tell me three things that happened today. Short sentences are fine. What happened first?"}
  ];

  /* 장면마다 여는 말을 여러 개 두고 날짜에 따라 돌려 쓴다 (매일 같은 질문이 되지 않게) */
  const OPENERS = {
    daily: ["What did you do yesterday? Tell me about your day from morning to evening.","Tell me about your neighborhood. What do you like about living there?","What do you usually do on your day off? Tell me about the last one.","Tell me about a meal you enjoyed recently. Who were you with, and what did you eat?","What is something you are looking forward to this month? Why?","Tell me about a trip you took with your family. Where did you go, and what happened?"],
    life: ["Imagine you are at a local market. I am the seller. Ask me about the price and buy some fruit.","Imagine you feel sick and you are at a small clinic. I am the doctor. Tell me what is wrong.","Imagine you need to open a bank account. I am the clerk. Explain what you need.","Imagine your water is not working. I am your landlord. Call me and explain the problem.","Imagine we meet at a school event. I am another parent. Start a friendly conversation with me.","Imagine you are lost. I am a person on the street. Ask me how to get to the bus station."],
    testimony: ["Tell me about a time when God answered your prayer. What happened?","Why did you become a pastor? Tell me the story.","Tell me about a hard time in your life. How did God help you through it?","Who helped you grow in your faith? Tell me about that person.","Why do you want to be a missionary? Tell me from your heart."],
    gospel: ["Imagine I say: I am a good person, so I do not need God. How would you answer me?","Imagine I ask you: Who is Jesus, and why did he die? Please explain simply.","Imagine I am going through a hard time and I ask: Does God really care about me? What would you say?","Imagine I want to believe, and I ask: What should I do now? Please guide me.","Please explain the word grace to me. I have never heard it before."],
    worship: ["Please lead an opening prayer for a Sunday service, as if we are starting right now.","Please introduce today's Scripture reading and invite the congregation to read together.","Please give the announcements: a meal after the service and a prayer meeting on Friday night.","Please invite the congregation to give their offering and pray a short offering prayer.","Please give the benediction and send the people out with a blessing."],
    sermon: ["Tell me the main point of a sermon you preached recently, in three or four sentences.","Explain John 3:16 to me as if I am hearing it for the first time.","Tell me a short story from your life that you could use as a sermon illustration.","Choose one parable of Jesus and retell it in your own words.","Give me a one-minute message of encouragement for people who are tired."]
  };
  SCENES.forEach(function(sc){ sc.more = OPENERS[sc.id] || []; });

  const TEST = {
    read:["Every morning I wake up early and make coffee. Then I read the Bible for about twenty minutes. I think about what the passage means for my life. After that, I pray for my family and my church. This quiet time helps me start the day with peace.",
      "Last summer my family traveled to a small town by the sea. We stayed there for three days. The weather was hot, but the water was cool and clear. My sons swam all afternoon, and we ate fresh fruit together. It was one of the best trips we have ever had.",
      "Our church welcomes many visitors every week. Some of them are looking for answers, and others are just curious. We try to greet everyone with a warm smile. Through these small things, people often feel that they are loved. I believe that is where the gospel begins.",
      "Learning a new language takes time and patience. At first, the words feel strange in your mouth. But if you practice a little every day, they slowly become your own. Mistakes are not failures. They are steps on the road to speaking with confidence."],
    daily:["Tell me about your daily routine. What do you usually do in the morning and in the evening?","Describe your home and your neighborhood. What do you like about it?","What do you like to do when you have free time? Why?","Tell me about a person in your family. What is he or she like?"],
    story:["Tell me about a trip you took. Where did you go, and what happened?","Tell me about a time when someone helped you. What happened, and how did you feel?","Tell me about an important decision you made in your life.","Tell me about a day you will never forget."],
    explain:["Why do you want to be a missionary? Explain your reasons.","Explain what grace means to someone who has never been to church.","What makes a good leader? Give your opinion and an example.","How can a church help its neighbors? Share your ideas."]
  };

  const MISSIONS = [
    {id:"m_meal", t:"영어로 식사 기도 하기 (이번 주 세 번)"},
    {id:"m_comp", t:"「말씀함께」 영어판 오늘 본문을 소리 내어 읽고, 훈련의 「원고 낭독 코칭」으로 점검받기"},
    {id:"m_call", t:"이번 주 '예배로의 부름'을 영어로 옮겨 낭독 코칭받기 (영어 원고는 Claude에게 부탁)"},
    {id:"m_listen", t:"영어 설교나 예배 영상을 10분 듣고 한 문장 따라 말하기"},
    {id:"m_voice", t:"아는 선교사님이나 원어민에게 30초 영어 음성 메시지 보내기"},
    {id:"m_family", t:"가족에게 오늘 있었던 일을 영어 세 문장으로 말하기"},
    {id:"m_self", t:"간증 1분 버전을 휴대폰으로 녹음해서 직접 들어 보기"},
    {id:"m_verse", t:"영어 성경 한 구절을 외워서 소리 내어 말하기"},
    {id:"m_tutor", t:"이번 달 원어민(튜터, 선교사)과 15분 대화 약속 잡기"},
    {id:"m_bless", t:"영어 축도를 외워서 말하기"},
    {id:"m_news", t:"영어 뉴스레터나 영어 뉴스 첫 화면에서 제목 다섯 개와 첫 문장만 소리 내어 읽기"},
    {id:"m_mumble", t:"오늘 익힌 문장을 이동하는 길에 「듣기」로 듣고 중얼중얼 따라 말하기"}
  ];

  const PLAN = {5:{phr:3, dr:2, talk:1, retell:0}, 15:{phr:5, dr:4, talk:2, retell:1}, 30:{phr:8, dr:6, talk:4, retell:2}, 60:{phr:10, dr:8, talk:6, retell:3}};
  /* 이번 버전에서 바뀐 것: 맨 위가 지금 판 (시험이 BUILD와 맞는지 확인한다) */
  const CHANGELOG = [
    [34, "2026-11-16", "구문 화면의 상황별 단추에 구문 수 표시"],
    [33, "2026-11-16", "선생님 답의 우리말 글자가 깨지면 다른 모델로 다시 받고, 그래도 깨진 문장은 보여 주지 않음 · 「훈련」에 듣기 · 귀 뚫기 코너: 새로 쓴 1분 이야기를 글 없이 듣기 → 받아쓰기 → 글 보며 확인 → 따라 말하기 · 이어 듣기에 듣기 이야기 묶음"],
    [32, "2026-11-16", "소리를 듣는 중에 화면을 만지면 끊기던 오류 수정 · 왼쪽 위 홈 단추 · 맨 위에서 길게 당겨 새로 고침 · 레벨 테스트 대답에도 문장별 모범답안 · 나가 있는 동안 끝난 채점 결과를 돌아오면 보여 줌"],
    [31, "2026-11-16", "레벨 테스트 대답에도 문장별 모범답안(듣기·담기) · 나가 있는 동안 끝난 채점 결과를 돌아오면 바로 보여 줌"],
    [30, "2026-11-16", "소리가 나는 동안에는 새 버전으로 바꾸지 않음(듣는 중 끊김 방지) · 이어 듣기의 쉬는 구간을 오디오로 이어 화면이 꺼져도 덜 끊기게"],
    [29, "2026-11-16", "무료 한도 아끼기: 구문·훈련 채점은 한도가 넉넉한 Lite 모델부터, 좋은 모델은 대화·레벨 테스트에 · 함께 쓰는 키 사용자에게 내 무료 키 안내"],
    [28, "2026-11-16", "「구문」 화면에서 「마주친 표현 물어보기」와 「내 구문 담기」 칸을 뺌 (담아 둔 구문과 기록은 그대로)"],
    [27, "2026-11-16", "이어 듣기(멈출 때까지 되풀이·따라 말할 틈·빠르기) · 배지 · 최근 12주 출석 · 함께 보기를 기록 화면으로 옮기고 구글 계정 이름으로 표시"],
    [26, "2026-11-16", "함께 보기: 서로의 이번 주 학습 현황 (설정에서 끌 수 있음)"],
    [25, "2026-11-16", "대화는 정한 횟수에서 끝 · 홈 「나의 학습 현황」 · 마이크 허용 안내"],
    [24, "2026-11-16", "모범답안 문장별 듣기·모음 · 지난 문장 복습 3문제 · 오늘 하루 세 문장 · 마주친 표현 물어보기"],
    [23, "2026-11-16", "5분 과정 · 누적 암송(오늘 + 어제)"],
    [22, "2026-11-16", "채점을 세 개씩 나눠 보내 멈춤 방지 · 새 버전 자동 반영"]
  ];
  /* 우리말에서 실제로 쓰는 글자 2,350자(KS X 1001). 이 밖의 글자가 섞인 답은 모델이 글자를 깨뜨린 것으로 본다. */
  const KO_COMMON = "가각간갇갈갉갊감갑값갓갔강갖갗같갚갛개객갠갤갬갭갯갰갱갸갹갼걀걋걍걔걘걜거걱건걷걸걺검겁것겄겅겆겉겊겋게겐겔겜겝겟겠겡겨격겪견겯결겸겹겻겼경곁계곈곌곕곗고곡곤곧골곪곬곯곰곱곳공곶과곽관괄괆괌괍괏광괘괜괠괩괬괭괴괵괸괼굄굅굇굉교굔굘굡굣구국군굳굴굵굶굻굼굽굿궁궂궈궉권궐궜궝궤궷귀귁귄귈귐귑귓규균귤그극근귿글긁금급긋긍긔기긱긴긷길긺김깁깃깅깆깊까깍깎깐깔깖깜깝깟깠깡깥깨깩깬깰깸깹깻깼깽꺄꺅꺌꺼꺽꺾껀껄껌껍껏껐껑께껙껜껨껫껭껴껸껼꼇꼈꼍꼐꼬꼭꼰꼲꼴꼼꼽꼿꽁꽂꽃꽈꽉꽐꽜꽝꽤꽥꽹꾀꾄꾈꾐꾑꾕꾜꾸꾹꾼꿀꿇꿈꿉꿋꿍꿎꿔꿜꿨꿩꿰꿱꿴꿸뀀뀁뀄뀌뀐뀔뀜뀝뀨끄끅끈끊끌끎끓끔끕끗끙끝끼끽낀낄낌낍낏낑나낙낚난낟날낡낢남납낫났낭낮낯낱낳내낵낸낼냄냅냇냈냉냐냑냔냘냠냥너넉넋넌널넒넓넘넙넛넜넝넣네넥넨넬넴넵넷넸넹녀녁년녈념녑녔녕녘녜녠노녹논놀놂놈놉놋농높놓놔놘놜놨뇌뇐뇔뇜뇝뇟뇨뇩뇬뇰뇹뇻뇽누눅눈눋눌눔눕눗눙눠눴눼뉘뉜뉠뉨뉩뉴뉵뉼늄늅늉느늑는늘늙늚늠늡늣능늦늪늬늰늴니닉닌닐닒님닙닛닝닢다닥닦단닫달닭닮닯닳담답닷닸당닺닻닿대댁댄댈댐댑댓댔댕댜더덕덖던덛덜덞덟덤덥덧덩덫덮데덱덴델뎀뎁뎃뎄뎅뎌뎐뎔뎠뎡뎨뎬도독돈돋돌돎돐돔돕돗동돛돝돠돤돨돼됐되된될됨됩됫됴두둑둔둘둠둡둣둥둬뒀뒈뒝뒤뒨뒬뒵뒷뒹듀듄듈듐듕드득든듣들듦듬듭듯등듸디딕딘딛딜딤딥딧딨딩딪따딱딴딸땀땁땃땄땅땋때땍땐땔땜땝땟땠땡떠떡떤떨떪떫떰떱떳떴떵떻떼떽뗀뗄뗌뗍뗏뗐뗑뗘뗬또똑똔똘똥똬똴뙈뙤뙨뚜뚝뚠뚤뚫뚬뚱뛔뛰뛴뛸뜀뜁뜅뜨뜩뜬뜯뜰뜸뜹뜻띄띈띌띔띕띠띤띨띰띱띳띵라락란랄람랍랏랐랑랒랖랗래랙랜랠램랩랫랬랭랴략랸럇량러럭런럴럼럽럿렀렁렇레렉렌렐렘렙렛렝려력련렬렴렵렷렸령례롄롑롓로록론롤롬롭롯롱롸롼뢍뢨뢰뢴뢸룀룁룃룅료룐룔룝룟룡루룩룬룰룸룹룻룽뤄뤘뤠뤼뤽륀륄륌륏륑류륙륜률륨륩륫륭르륵른를름릅릇릉릊릍릎리릭린릴림립릿링마막만많맏말맑맒맘맙맛망맞맡맣매맥맨맬맴맵맷맸맹맺먀먁먈먕머먹먼멀멂멈멉멋멍멎멓메멕멘멜멤멥멧멨멩며멱면멸몃몄명몇몌모목몫몬몰몲몸몹못몽뫄뫈뫘뫙뫼묀묄묍묏묑묘묜묠묩묫무묵묶문묻물묽묾뭄뭅뭇뭉뭍뭏뭐뭔뭘뭡뭣뭬뮈뮌뮐뮤뮨뮬뮴뮷므믄믈믐믓미믹민믿밀밂밈밉밋밌밍및밑바박밖밗반받발밝밞밟밤밥밧방밭배백밴밸뱀뱁뱃뱄뱅뱉뱌뱍뱐뱝버벅번벋벌벎범법벗벙벚베벡벤벧벨벰벱벳벴벵벼벽변별볍볏볐병볕볘볜보복볶본볼봄봅봇봉봐봔봤봬뵀뵈뵉뵌뵐뵘뵙뵤뵨부북분붇불붉붊붐붑붓붕붙붚붜붤붰붸뷔뷕뷘뷜뷩뷰뷴뷸븀븃븅브븍븐블븜븝븟비빅빈빌빎빔빕빗빙빚빛빠빡빤빨빪빰빱빳빴빵빻빼빽뺀뺄뺌뺍뺏뺐뺑뺘뺙뺨뻐뻑뻔뻗뻘뻠뻣뻤뻥뻬뼁뼈뼉뼘뼙뼛뼜뼝뽀뽁뽄뽈뽐뽑뽕뾔뾰뿅뿌뿍뿐뿔뿜뿟뿡쀼쁑쁘쁜쁠쁨쁩삐삑삔삘삠삡삣삥사삭삯산삳살삵삶삼삽삿샀상샅새색샌샐샘샙샛샜생샤샥샨샬샴샵샷샹섀섄섈섐섕서석섞섟선섣설섦섧섬섭섯섰성섶세섹센셀셈셉셋셌셍셔셕션셜셤셥셧셨셩셰셴셸솅소속솎손솔솖솜솝솟송솥솨솩솬솰솽쇄쇈쇌쇔쇗쇘쇠쇤쇨쇰쇱쇳쇼쇽숀숄숌숍숏숑수숙순숟술숨숩숫숭숯숱숲숴쉈쉐쉑쉔쉘쉠쉥쉬쉭쉰쉴쉼쉽쉿슁슈슉슐슘슛슝스슥슨슬슭슴습슷승시식신싣실싫심십싯싱싶싸싹싻싼쌀쌈쌉쌌쌍쌓쌔쌕쌘쌜쌤쌥쌨쌩썅써썩썬썰썲썸썹썼썽쎄쎈쎌쏀쏘쏙쏜쏟쏠쏢쏨쏩쏭쏴쏵쏸쐈쐐쐤쐬쐰쐴쐼쐽쑈쑤쑥쑨쑬쑴쑵쑹쒀쒔쒜쒸쒼쓩쓰쓱쓴쓸쓺쓿씀씁씌씐씔씜씨씩씬씰씸씹씻씽아악안앉않알앍앎앓암압앗았앙앝앞애액앤앨앰앱앳앴앵야약얀얄얇얌얍얏양얕얗얘얜얠얩어억언얹얻얼얽얾엄업없엇었엉엊엌엎에엑엔엘엠엡엣엥여역엮연열엶엷염엽엾엿였영옅옆옇예옌옐옘옙옛옜오옥온올옭옮옰옳옴옵옷옹옻와왁완왈왐왑왓왔왕왜왝왠왬왯왱외왹왼욀욈욉욋욍요욕욘욜욤욥욧용우욱운울욹욺움웁웃웅워웍원월웜웝웠웡웨웩웬웰웸웹웽위윅윈윌윔윕윗윙유육윤율윰윱윳융윷으윽은을읊음읍읏응읒읓읔읕읖읗의읜읠읨읫이익인일읽읾잃임입잇있잉잊잎자작잔잖잗잘잚잠잡잣잤장잦재잭잰잴잼잽잿쟀쟁쟈쟉쟌쟎쟐쟘쟝쟤쟨쟬저적전절젊점접젓정젖제젝젠젤젬젭젯젱져젼졀졈졉졌졍졔조족존졸졺좀좁좃종좆좇좋좌좍좔좝좟좡좨좼좽죄죈죌죔죕죗죙죠죡죤죵주죽준줄줅줆줌줍줏중줘줬줴쥐쥑쥔쥘쥠쥡쥣쥬쥰쥴쥼즈즉즌즐즘즙즛증지직진짇질짊짐집짓징짖짙짚짜짝짠짢짤짧짬짭짯짰짱째짹짼쨀쨈쨉쨋쨌쨍쨔쨘쨩쩌쩍쩐쩔쩜쩝쩟쩠쩡쩨쩽쪄쪘쪼쪽쫀쫄쫌쫍쫏쫑쫓쫘쫙쫠쫬쫴쬈쬐쬔쬘쬠쬡쭁쭈쭉쭌쭐쭘쭙쭝쭤쭸쭹쮜쮸쯔쯤쯧쯩찌찍찐찔찜찝찡찢찧차착찬찮찰참찹찻찼창찾채책챈챌챔챕챗챘챙챠챤챦챨챰챵처척천철첨첩첫첬청체첵첸첼쳄쳅쳇쳉쳐쳔쳤쳬쳰촁초촉촌촐촘촙촛총촤촨촬촹최쵠쵤쵬쵭쵯쵱쵸춈추축춘출춤춥춧충춰췄췌췐취췬췰췸췹췻췽츄츈츌츔츙츠측츤츨츰츱츳층치칙친칟칠칡침칩칫칭카칵칸칼캄캅캇캉캐캑캔캘캠캡캣캤캥캬캭컁커컥컨컫컬컴컵컷컸컹케켁켄켈켐켑켓켕켜켠켤켬켭켯켰켱켸코콕콘콜콤콥콧콩콰콱콴콸쾀쾅쾌쾡쾨쾰쿄쿠쿡쿤쿨쿰쿱쿳쿵쿼퀀퀄퀑퀘퀭퀴퀵퀸퀼큄큅큇큉큐큔큘큠크큭큰클큼큽킁키킥킨킬킴킵킷킹타탁탄탈탉탐탑탓탔탕태택탠탤탬탭탯탰탱탸턍터턱턴털턺텀텁텃텄텅테텍텐텔템텝텟텡텨텬텼톄톈토톡톤톨톰톱톳통톺톼퇀퇘퇴퇸툇툉툐투툭툰툴툼툽툿퉁퉈퉜퉤튀튁튄튈튐튑튕튜튠튤튬튱트특튼튿틀틂틈틉틋틔틘틜틤틥티틱틴틸팀팁팃팅파팍팎판팔팖팜팝팟팠팡팥패팩팬팰팸팹팻팼팽퍄퍅퍼퍽펀펄펌펍펏펐펑페펙펜펠펨펩펫펭펴편펼폄폅폈평폐폘폡폣포폭폰폴폼폽폿퐁퐈퐝푀푄표푠푤푭푯푸푹푼푿풀풂품풉풋풍풔풩퓌퓐퓔퓜퓟퓨퓬퓰퓸퓻퓽프픈플픔픕픗피픽핀필핌핍핏핑하학한할핥함합핫항해핵핸핼햄햅햇했행햐향허헉헌헐헒험헙헛헝헤헥헨헬헴헵헷헹혀혁현혈혐협혓혔형혜혠혤혭호혹혼홀홅홈홉홋홍홑화확환활홧황홰홱홴횃횅회획횐횔횝횟횡효횬횰횹횻후훅훈훌훑훔훗훙훠훤훨훰훵훼훽휀휄휑휘휙휜휠휨휩휫휭휴휵휸휼흄흇흉흐흑흔흖흗흘흙흠흡흣흥흩희흰흴흼흽힁히힉힌힐힘힙힛힝";
  return {TAGS, TAG_IDS, ORDER, CATS, PHRASES, SCENES, TEST, MISSIONS, PLAN, CHANGELOG, KO_COMMON};
})();
