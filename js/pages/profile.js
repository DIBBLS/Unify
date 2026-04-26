import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut, updateProfile as fbUp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, addDoc, query, where, orderBy, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
let currentUser=null,profile={},posts=[],works=[],activePostTag=null;
// ── THEME handled by js/theme.js ──────────────────────

onAuthStateChanged(auth,async user=>{
  if(!user){window.location.href='auth.html';return;}
  currentUser=user;
  const init=(user.displayName||user.email||'U')[0].toUpperCase();
  document.getElementById('heroAvatar').textContent=init;
  document.getElementById('composerAv').textContent=init;
  await loadProfile();
  await Promise.all([loadPosts(),loadWorks()]);
  document.getElementById('loadingOverlay').style.display='none';
});
document.getElementById('signOutBtn').addEventListener('click',async()=>{await signOut(auth);window.location.href='auth.html';});

async function loadProfile(){
  try{const snap=await getDoc(doc(db,'users',currentUser.uid));if(snap.exists())profile=snap.data();}catch(e){profile={};}
  renderProfile();
}

function renderProfile(){
  const name=profile.firstName||currentUser.displayName||currentUser.email?.split('@')[0]||'Builder';
  document.getElementById('heroName').textContent=name;
  document.getElementById('heroAvatar').textContent=name[0].toUpperCase();
  document.getElementById('composerAv').textContent=name[0].toUpperCase();

  const hl=document.getElementById('heroHeadline');
  if(profile.headline){hl.textContent=profile.headline;hl.style.display='block';}else{hl.style.display='none';}

  const bio=document.getElementById('heroBio');
  if(profile.bio){bio.textContent=profile.bio;bio.classList.remove('empty');}
  else{bio.textContent='What are you building?';bio.classList.add('empty');}

  const tags=document.getElementById('heroTags');
  tags.innerHTML='';
  if(profile.department){const t=document.createElement('span');t.className='ptag';t.textContent=`${profile.level||''} · ${profile.department}`;tags.appendChild(t);}
  if(profile.university){const t=document.createElement('span');t.className='ptag';t.textContent=profile.university;tags.appendChild(t);}
  if(profile.openToCollab){const t=document.createElement('span');t.className='ptag collab';t.textContent='Open to collab';tags.appendChild(t);}

  const ab=document.getElementById('aboutBio');
  if(profile.bio){ab.textContent=profile.bio;ab.classList.remove('empty');}

  const int=document.getElementById('aboutInterests');
  if(profile.interests?.length){int.innerHTML=profile.interests.map(i=>`<span class="interest">${i}</span>`).join('');}

  const lnk=document.getElementById('aboutLinks');
  const links=[];
  if(profile.link1)links.push(`<a class="about-link" href="${profile.link1}" target="_blank">↗ ${profile.link1.replace(/https?:\/\//,'')}</a>`);
  if(profile.link2)links.push(`<a class="about-link" href="${profile.link2}" target="_blank">↗ ${profile.link2.replace(/https?:\/\//,'')}</a>`);
  if(links.length)lnk.innerHTML=links.join('');
}

async function loadPosts(){
  try{
    const q=query(collection(db,'profile_posts'),where('authorId','==',currentUser.uid),orderBy('createdAt','desc'));
    const snap=await getDocs(q);
    posts=snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){
    posts=JSON.parse(localStorage.getItem('unify-myposts-'+currentUser.uid)||'[]');
  }
  renderPosts();updateStats();
}

function renderPosts(){
  const feed=document.getElementById('postsFeed');
  if(!posts.length){feed.innerHTML=`<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:13px;line-height:1.8">Nothing here yet.<br>Share what you're working on.</div>`;return;}
  feed.innerHTML=posts.map(p=>postCardHTML(p)).join('');
}

function postCardHTML(p){
  const init=(p.author||'U')[0].toUpperCase();
  const ts=p.createdAt?.seconds||p._ts||Date.now()/1000;
  const collabHTML=p.collaborators?.length?`<div class="pc-collabs">with ${p.collaborators.map(c=>`<a onclick="showToast('${c}')">${c}</a>`).join(', ')}</div>`:'';
  const liked=p.likes?.includes(currentUser?.uid);
  return `<div class="post-card" id="pc-${p.id}">
    <div class="pc-meta">
      <div class="pc-av">${init}</div>
      <div><div class="pc-name">${p.author||'You'}</div><div class="pc-info">${[p.dept,p.university].filter(Boolean).join(' · ')}</div></div>
      <div class="pc-time">${timeAgo(ts)}</div>
    </div>
    ${p.tag?`<span class="pc-tag">${p.tag}</span>`:''}
    <div class="pc-content">${p.content}</div>
    ${collabHTML}
    <div class="pc-actions">
      <button class="pc-action ${liked?'liked':''}" onclick="likePost('${p.id}')">♡ ${p.likes?.length||0}</button>
      <button class="pc-action" onclick="toggleComments('${p.id}')">${p.comments?.length||0} comments</button>
      <button class="pc-del" onclick="deletePost('${p.id}')">Delete</button>
    </div>
    <div class="comments-wrap" id="cw-${p.id}">
      <div class="comment-list" id="cl-${p.id}">
        ${(p.comments||[]).map(c=>`<div class="comment"><div class="cm-av">${(c.author||'?')[0].toUpperCase()}</div><div class="cm-bubble"><div class="cm-author">${c.author}</div><div class="cm-text">${c.text}</div></div></div>`).join('')}
      </div>
      <div class="cm-composer">
        <div class="cm-av">${(currentUser.displayName||'U')[0].toUpperCase()}</div>
        <input class="cm-input" id="ci-${p.id}" placeholder="Add a comment…" onkeydown="if(event.key==='Enter')addComment('${p.id}')">
        <button class="cm-send" onclick="addComment('${p.id}')">Post</button>
      </div>
    </div>
  </div>`;
}

async function loadWorks(){
  try{
    const q=query(collection(db,'works'),where('authorId','==',currentUser.uid),orderBy('createdAt','desc'));
    const snap=await getDocs(q);
    works=snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){
    works=JSON.parse(localStorage.getItem('unify-works-'+currentUser.uid)||'[]');
  }
  renderWorks();updateStats();
}

function renderWorks(){
  const list=document.getElementById('workList');
  if(!works.length){list.innerHTML=`<div class="work-empty">No projects yet.<br>Add what you're building — tag collaborators to give them credit.</div>`;return;}
  const sc={wip:'wc-wip',done:'wc-done',idea:'wc-idea'};
  const sl={wip:'In progress',done:'Completed',idea:'Idea'};
  list.innerHTML=works.map(w=>`<div class="work-card">
    <div class="wc-top"><div class="wc-title">${w.name}</div><span class="wc-status ${sc[w.status]||'wc-idea'}">${sl[w.status]||w.status}</span></div>
    <div class="wc-desc">${w.desc}</div>
    ${w.tags?.length?`<div class="wc-tags">${w.tags.map(t=>`<span class="wc-tag">${t}</span>`).join('')}</div>`:''}
    ${w.collaborators?.length?`<div class="wc-collabs">with ${w.collaborators.map(c=>`<a onclick="showToast('${c}')">${c}</a>`).join(', ')}</div>`:''}
    <button class="wc-del" onclick="deleteWork('${w.id}')">Remove ×</button>
  </div>`).join('');
}

function updateStats(){
  document.getElementById('statPosts').textContent=posts.length;
  document.getElementById('statWork').textContent=works.length;
  document.getElementById('statCollabs').textContent=works.filter(w=>w.collaborators?.length>0).length;
}

window.toggleCTag=function(el,tag){
  document.querySelectorAll('.c-tag').forEach(t=>t.classList.remove('on'));
  if(activePostTag===tag){activePostTag=null;}else{el.classList.add('on');activePostTag=tag;}
};

window.submitPost=async function(){
  const content=document.getElementById('postInput').value.trim();
  if(!content)return;
  const name=profile.firstName||currentUser.displayName||currentUser.email?.split('@')[0]||'Builder';
  const postData={authorId:currentUser.uid,author:name,dept:profile.department||'',university:profile.university||'',content,tag:activePostTag||null,collaborators:[],likes:[],comments:[],createdAt:{seconds:Date.now()/1000}};
  try{
    const ref=await addDoc(collection(db,'profile_posts'),{...postData,createdAt:new Date()});
    posts.unshift({id:ref.id,...postData});
  }catch(e){posts.unshift({id:'local_'+Date.now(),...postData});}
  try{const key='unify-myposts-'+currentUser.uid;const ex=JSON.parse(localStorage.getItem(key)||'[]');ex.unshift({...posts[0],_ts:Date.now()/1000,_type:'post'});localStorage.setItem(key,JSON.stringify(ex.slice(0,50)));}catch(e){}
  document.getElementById('postInput').value='';
  document.querySelectorAll('.c-tag').forEach(t=>t.classList.remove('on'));
  activePostTag=null;
  renderPosts();updateStats();showToast('Posted.');
};

window.deletePost=async function(id){
  if(!confirm('Delete this post?'))return;
  posts=posts.filter(p=>p.id!==id);
  if(!id.startsWith('local_')){try{await deleteDoc(doc(db,'profile_posts',id));}catch(e){}}
  renderPosts();updateStats();
};

window.likePost=function(id){
  const p=posts.find(x=>x.id===id);if(!p)return;
  const uid=currentUser.uid;
  p.likes=p.likes?.includes(uid)?p.likes.filter(x=>x!==uid):[...(p.likes||[]),uid];
  renderPosts();
};

window.toggleComments=function(id){const cw=document.getElementById('cw-'+id);if(cw)cw.classList.toggle('open');};

window.addComment=async function(id){
  const input=document.getElementById('ci-'+id);
  const text=input?.value.trim();if(!text)return;
  const name=profile.firstName||currentUser.displayName||'Builder';
  const p=posts.find(x=>x.id===id);if(!p)return;
  if(!p.comments)p.comments=[];
  p.comments.push({author:name,text});
  input.value='';
  renderPosts();
  setTimeout(()=>{const cw=document.getElementById('cw-'+id);if(cw)cw.classList.add('open');},10);
};

window.openWorkForm=()=>document.getElementById('workForm').classList.add('on');
window.closeWorkForm=()=>document.getElementById('workForm').classList.remove('on');

window.saveWork=async function(){
  const name=document.getElementById('wName').value.trim();
  const desc=document.getElementById('wDesc').value.trim();
  if(!name||!desc){showToast('Name and description required.');return;}
  const tags=document.getElementById('wTags').value.split(',').map(s=>s.trim()).filter(Boolean);
  const collaborators=document.getElementById('wCollabs').value.split(',').map(s=>s.trim()).filter(Boolean);
  const status=document.getElementById('wStatus').value;
  const data={authorId:currentUser.uid,name,desc,tags,collaborators,status,createdAt:{seconds:Date.now()/1000}};
  try{const ref=await addDoc(collection(db,'works'),{...data,createdAt:new Date()});works.unshift({id:ref.id,...data});}
  catch(e){works.unshift({id:'local_'+Date.now(),...data});}
  ['wName','wDesc','wTags','wCollabs'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('wStatus').value='wip';
  closeWorkForm();renderWorks();updateStats();showToast('Project saved.');
};

window.deleteWork=async function(id){
  if(!confirm('Remove this project?'))return;
  works=works.filter(w=>w.id!==id);
  if(!id.startsWith('local_')){try{await deleteDoc(doc(db,'works',id));}catch(e){}}
  renderWorks();updateStats();
};

window.openDrawer=function(){
  document.getElementById('dName').value=profile.firstName||currentUser.displayName||'';
  document.getElementById('dHeadline').value=profile.headline||'';
  document.getElementById('dBio').value=profile.bio||'';
  document.getElementById('dInterests').value=(profile.interests||[]).join(', ');
  document.getElementById('dLink1').value=profile.link1||'';
  document.getElementById('dLink2').value=profile.link2||'';
  document.getElementById('dCollab').checked=!!profile.openToCollab;
  document.getElementById('drawer').classList.add('on');
  document.getElementById('drawerOverlay').classList.add('on');
};
window.closeDrawer=function(){
  document.getElementById('drawer').classList.remove('on');
  document.getElementById('drawerOverlay').classList.remove('on');
};

window.saveProfile=async function(){
  const firstName=document.getElementById('dName').value.trim();
  const interests=document.getElementById('dInterests').value.split(',').map(s=>s.trim()).filter(Boolean);
  const updated={...profile,firstName,headline:document.getElementById('dHeadline').value.trim(),bio:document.getElementById('dBio').value.trim(),interests,link1:document.getElementById('dLink1').value.trim(),link2:document.getElementById('dLink2').value.trim(),openToCollab:document.getElementById('dCollab').checked};
  try{
    await setDoc(doc(db,'users',currentUser.uid),updated,{merge:true});
    if(firstName)await fbUp(auth.currentUser,{displayName:firstName});
    profile=updated;renderProfile();closeDrawer();showToast('Saved.');
  }catch(e){showToast('Error saving.');}
};

window.switchTab=function(tab,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('pane-'+tab).classList.add('on');
};

function timeAgo(ts){
  const s=Math.floor(Date.now()/1000-ts);
  if(s<60)return'just now';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}

function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}
window.showToast=showToast;
