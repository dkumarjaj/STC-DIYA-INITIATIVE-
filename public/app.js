(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const form = $("submissionForm");
  if (!form) return;
  const mediaInput=$("media"), dropzone=document.querySelector(".dropzone"), statusBox=$("formStatus");
  const submitButton=form.querySelector('button[type="submit"]'), submitText=$("submitText");
  const previewWrap=$("previewWrap"), imagePreview=$("imagePreview"), videoPreview=$("videoPreview"), fileActions=$("fileActions");
  let maxFileSizeMb=100, previewUrl=null, certificateData={name:"",message:"",className:""};
  const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif","video/mp4","video/quicktime","video/webm","video/3gpp"]);

  function setStatus(message,isError=false){
    statusBox.textContent=message;
    statusBox.classList.toggle("error",isError);
    statusBox.classList.toggle("success",!isError&&!!message);
  }
  fetch("/api/config").then(r=>{if(!r.ok)throw new Error();return r.json()}).then(config=>{
    maxFileSizeMb=Number(config.maxFileSizeMb)||100;
    $("maxSize").textContent=`${maxFileSizeMb} MB`;
    const wa=$("whatsappLink"); if(config.whatsappGroupLink)wa.href=config.whatsappGroupLink;else wa.hidden=true;
    const official=$("officialLink"), url=config.officialWebsiteUrl||config.schoolWebsiteUrl;
    if(url){official.href=url;official.hidden=false;const footerOfficial=$("officialLinkFooter");if(footerOfficial){footerOfficial.href=url;footerOfficial.hidden=false}}else official.hidden=true;
  }).catch(()=>setStatus("Some page settings could not be loaded. You can still submit your entry."));

  function revokePreview(){
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    previewUrl=null; imagePreview.removeAttribute("src"); videoPreview.removeAttribute("src"); videoPreview.load();
    imagePreview.hidden=true;videoPreview.hidden=true;previewWrap.hidden=true;fileActions.hidden=true;
  }
  function showFile(file){
    revokePreview();
    if(!file){
      $("fileTitle").textContent="Choose a photo or video";
      $("fileSub").innerHTML=`JPG, PNG, WEBP, HEIC, MP4, MOV, WEBM · Maximum <b>${maxFileSizeMb} MB</b>`;
      $("filePreview").textContent="";return;
    }
    $("fileTitle").textContent=file.name;
    $("fileSub").textContent=`${(file.size/1048576).toFixed(1)} MB · ${file.type.startsWith("video/")?"Video":"Image"}`;
    $("filePreview").textContent="Selected and ready to submit";
    if(file.type.startsWith("image/")&&!['image/heic','image/heif'].includes(file.type)){
      previewUrl=URL.createObjectURL(file);imagePreview.src=previewUrl;imagePreview.hidden=false;previewWrap.hidden=false;
    }else if(file.type.startsWith("video/")){
      previewUrl=URL.createObjectURL(file);videoPreview.src=previewUrl;videoPreview.hidden=false;previewWrap.hidden=false;
    }
    fileActions.hidden=false;
  }
  mediaInput.addEventListener("change",()=>showFile(mediaInput.files[0]));
  $("removeFile").addEventListener("click",e=>{e.preventDefault();mediaInput.value="";showFile(null)});
  ["dragenter","dragover"].forEach(t=>dropzone.addEventListener(t,e=>{e.preventDefault();dropzone.classList.add("dragover")}));
  ["dragleave","drop"].forEach(t=>dropzone.addEventListener(t,e=>{e.preventDefault();dropzone.classList.remove("dragover")}));
  dropzone.addEventListener("drop",e=>{
    const file=e.dataTransfer.files&&e.dataTransfer.files[0];if(!file)return;
    const dt=new DataTransfer();dt.items.add(file);mediaInput.files=dt.files;showFile(file);
  });
  function uploadWithProgress(payload){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open("POST","/api/submissions");xhr.responseType="json";
      xhr.upload.addEventListener("progress",e=>{if(e.lengthComputable){const pct=Math.round(e.loaded/e.total*100);submitText.textContent=`Uploading… ${pct}%`;submitButton.style.setProperty("--upload-progress",`${pct}%`)}});
      xhr.onload=()=>{const data=xhr.response||{};if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(new Error(data.error||`Upload failed (${xhr.status}). Please try again.`))};
      xhr.onerror=()=>reject(new Error("Network error. Check your connection and try again."));
      xhr.ontimeout=()=>reject(new Error("Upload timed out. Try a smaller file or stronger connection."));
      xhr.timeout=600000;xhr.send(payload);
    });
  }
  form.addEventListener("submit",async e=>{
    e.preventDefault();setStatus("");const file=mediaInput.files[0];
    if(!file)return setStatus("Please choose a photo or video before submitting.",true);
    if(!allowedTypes.has(file.type))return setStatus("Unsupported file type. Choose JPG, PNG, WEBP, HEIC, MP4, MOV, WEBM or 3GP.",true);
    if(file.size>maxFileSizeMb*1048576)return setStatus(`Your file is larger than ${maxFileSizeMb} MB. Please choose a smaller file.`,true);
    if(!form.elements.consent.checked)return setStatus("Please confirm parent/guardian permission before submitting.",true);
    submitButton.disabled=true;submitButton.classList.add("is-uploading");submitText.textContent="Preparing upload…";
    try{
      const result=await uploadWithProgress(new FormData(form));
      certificateData=result.certificate||{name:form.elements.studentName.value,message:form.elements.message.value||"A light for a brighter tomorrow",className:form.elements.className.value};
      form.reset();showFile(null);setStatus("Your photo/video has been submitted successfully. Your participation certificate is ready.");openCertificate(certificateData);
    }catch(err){setStatus(err.message||"Could not submit right now. Please try again.",true)}
    finally{submitButton.disabled=false;submitButton.classList.remove("is-uploading");submitButton.style.removeProperty("--upload-progress");submitText.textContent="Submit your diya story"}
  });

  // Digital diya: tap the matchstick, then tap the wick.
  const digitalName=$("digitalName"),digitalThought=$("digitalThought"),digitalStage=$("digitalStage"),matchstick=$("matchstick"),digitalWick=$("digitalWick"),lightStatus=$("lightStatus"),digitalResult=$("digitalResult");
  let matchReady=false;
  matchstick.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();matchstick.click()}});
  matchstick.addEventListener("click",()=>{
    if(!digitalName.value.trim()){digitalName.focus();lightStatus.textContent="Enter your name to begin.";return}
    matchReady=true;matchstick.classList.add("ready");lightStatus.textContent="The match is lit. Now touch the diya wick.";
  });
  function lightDigitalDiya(){
    if(!matchReady||digitalStage.classList.contains("lit"))return;
    digitalStage.classList.add("lit");matchReady=false;matchstick.classList.remove("ready");
    const name=digitalName.value.trim().slice(0,60),thought=digitalThought.value;
    lightStatus.textContent="Your diya is glowing. Your promise matters.";
    $("digitalResultName").textContent=name;$("digitalResultThought").textContent=thought;digitalResult.hidden=false;
    certificateData={name,message:thought,className:"Digital Diya Participant"};
  }
  digitalWick.addEventListener("click",lightDigitalDiya);
  digitalWick.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();lightDigitalDiya()}});
  $("digitalCertificate").addEventListener("click",()=>openCertificate(certificateData));

  // PNG certificate generator shared by media submissions and digital diya.
  const modal=$("certificateModal"),canvas=$("certificateCanvas"),ctx=canvas.getContext("2d"),logo=new Image();logo.src="/assets/school-emblem.png";
  function wrapText(c,text,x,y,maxWidth,lineHeight,maxLines=2){
    const lines=[];let line="";
    for(const word of text.split(/\s+/)){const test=line?`${line} ${word}`:word;if(c.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}
    if(line)lines.push(line);lines.slice(0,maxLines).forEach((v,i)=>c.fillText(v,x,y+i*lineHeight));
  }
  function drawCertificate(data){
    const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#f7eddc";ctx.fillRect(0,0,w,h);ctx.fillStyle="#26151e";ctx.fillRect(22,22,w-44,h-44);
    ctx.strokeStyle="#d8ad68";ctx.lineWidth=7;ctx.strokeRect(45,45,w-90,h-90);ctx.strokeStyle="#9b7045";ctx.lineWidth=2;ctx.strokeRect(64,64,w-128,h-128);
    ctx.strokeStyle="rgba(226,190,132,.75)";ctx.lineWidth=2;
    for(const x of [112,w-112])for(const y of [112,h-112]){ctx.beginPath();ctx.arc(x,y,25,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x-38,y);ctx.lineTo(x+38,y);ctx.moveTo(x,y-38);ctx.lineTo(x,y+38);ctx.stroke()}
    if(logo.complete&&logo.naturalWidth)ctx.drawImage(logo,w/2-68,82,136,136);
    ctx.textAlign="center";ctx.fillStyle="#e6c58e";ctx.font="600 23px Georgia";ctx.fillText("ST. COLUMBUS PUBLIC SCHOOL",w/2,265);
    ctx.fillStyle="#f8efdc";ctx.font="bold 68px Georgia";ctx.fillText("CERTIFICATE",w/2,365);ctx.fillStyle="#d8ad68";ctx.font="26px Georgia";ctx.fillText("OF PARTICIPATION",w/2,414);
    ctx.fillStyle="#d9cabb";ctx.font="24px Georgia";ctx.fillText("This certificate is proudly presented to",w/2,500);
    ctx.fillStyle="#f1d39b";ctx.font="italic 62px Georgia";ctx.fillText(String(data.name||"Student Participant").slice(0,42),w/2,600);
    ctx.strokeStyle="#c59a5e";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(330,625);ctx.lineTo(1270,625);ctx.stroke();
    ctx.fillStyle="#e9dfd1";ctx.font="24px Georgia";ctx.fillText("for taking part in the Diya Prajwalan Initiative",w/2,690);
    ctx.fillStyle="#e7bd7d";ctx.font="italic 29px Georgia";wrapText(ctx,`“${String(data.message||"A light for a brighter tomorrow").slice(0,120)}”`,w/2,755,1100,40,2);
    ctx.fillStyle="#c7b7a4";ctx.font="19px Georgia";ctx.fillText("A promise to spread light, kindness and hope in our society.",w/2,850);
    ctx.fillStyle="#e6c58e";ctx.font="bold 18px Arial";ctx.fillText("EKDARA · JHAJHA",w/2,935);
    ctx.fillStyle="#bda98e";ctx.font="16px Arial";ctx.fillText("Generated by Bharat Tech Force · by - dkumajaj",w/2,985);
    ctx.fillStyle="#e4c68f";ctx.font="17px Georgia";ctx.fillText(new Date().toLocaleDateString("en-IN"),w/2,1025);
  }
  function openCertificate(data){certificateData=data||certificateData;drawCertificate(certificateData);modal.hidden=false;if(!logo.complete)logo.onload=()=>drawCertificate(certificateData)}
  $("closeCertificate").addEventListener("click",()=>modal.hidden=true);modal.addEventListener("click",e=>{if(e.target===modal)modal.hidden=true});
  const getPng=()=>new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  $("downloadCertificate").addEventListener("click",async()=>{
    const blob=await getPng();if(!blob)return setStatus("The certificate could not be created. Please try again.",true);
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`St-Columbus-Diya-Certificate-${(certificateData.name||"participant").replace(/[^a-z0-9-]/gi,"-")}.png`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  $("shareCertificate").addEventListener("click",async()=>{
    const blob=await getPng();if(!blob)return setStatus("The certificate could not be created. Please download it instead.",true);
    const file=new File([blob],"St-Columbus-Diya-Certificate.png",{type:"image/png"});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file],title:"My Diya Promise Certificate",text:"I took part in the Diya Prajwalan Initiative by St. Columbus Public School."})}
      catch(err){if(err.name!=="AbortError")setStatus("Sharing was unavailable. Download the PNG and share it manually.")}
    }else setStatus("This browser cannot share image files directly. Download the PNG, then attach it in WhatsApp or Instagram.");
  });
  $("whatsappCertificate").addEventListener("click",()=>{
    const text=`I took part in the Diya Prajwalan Initiative at St. Columbus Public School. My promise: ${certificateData.message||"A light for a brighter tomorrow"}. I am sharing my certificate with you!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer");
    setStatus("WhatsApp opened. Download the certificate PNG and attach it to your message.");
  });
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target)}}),{threshold:.12});
  document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));
})();
