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
    if(typeof DataTransfer==="undefined"){setStatus("Drag-and-drop is not supported in this browser. Please use Choose a photo or video.",true);return}
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
      // Preserve submitted values before resetting the form.
      const submittedName = form.elements.studentName.value.trim();
      const submittedAddress = form.elements.className.value.trim();
      const submittedMessage = form.elements.message.value.trim();
      const submittedMediaType = file.type.startsWith("video/") ? "video" : "photo";

      const result=await uploadWithProgress(new FormData(form));
      const serverCertificate = result.certificate || {};
      certificateData = {
        ...serverCertificate,
        name: serverCertificate.name || submittedName,
        address: submittedAddress || serverCertificate.address || "India",
        message: serverCertificate.message || submittedMessage ||
          "I promise to spread kindness, care for nature, and make tomorrow brighter.",
        mediaType: submittedMediaType,
        type: "moment"
      };

      form.reset();
      showFile(null);
      setStatus("Your photo/video moment has been shared successfully. Your personalised recognition card is ready.");
      openMomentCertificate(certificateData);
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
    certificateData={name,message:thought,className:"Digital Diya Participant",type:"honor"};
  }
  digitalWick.addEventListener("click",lightDigitalDiya);
  digitalWick.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();lightDigitalDiya()}});
  $("digitalCertificate").addEventListener("click",()=>openCertificate(certificateData));

  // PNG certificate generator shared by media submissions and digital diya.
  const modal=$("certificateModal"),canvas=$("certificateCanvas"),ctx=canvas.getContext("2d"),logo=new Image();logo.src="/assets/school-emblem.png";
  const principalSignature=new Image();
  principalSignature.src="/assets/principal-signature.png";
  // Shared Diwali certificate artwork. Both certificate types use the same
  // premium wine, ivory and antique-gold identity and retain the principal sign.
  function roundedRect(c,x,y,w,h,r){
    c.beginPath();
    c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
  }
  function fitText(c,text,maxWidth,startSize,minSize=18,fontFamily="Georgia",weight="600"){
    let size=startSize;
    do { c.font=`${weight} ${size}px ${fontFamily}`; if(c.measureText(text).width<=maxWidth) return; size-=2; } while(size>=minSize);
    c.font=`${weight} ${minSize}px ${fontFamily}`;
  }
  function wrapText(c,text,x,y,maxWidth,lineHeight,maxLines=3){
    const words=String(text||"").replace(/\s+/g," ").trim().split(" ");
    const lines=[]; let line="";
    for(const word of words){
      const candidate=line?`${line} ${word}`:word;
      if(c.measureText(candidate).width>maxWidth && line){lines.push(line);line=word;}
      else line=candidate;
    }
    if(line) lines.push(line);
    const visible=lines.slice(0,maxLines);
    if(lines.length>maxLines && visible.length){
      let last=visible[visible.length-1];
      while(last.length && c.measureText(`${last}…`).width>maxWidth) last=last.slice(0,-1);
      visible[visible.length-1]=`${last.trim()}…`;
    }
    visible.forEach((lineText,i)=>c.fillText(lineText,x,y+i*lineHeight));
    return visible.length;
  }
  function drawDiwaliFrame(){
    const w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#f4ead7";ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#24121c";roundedRect(ctx,22,22,w-44,h-44,28);ctx.fill();
    const g=ctx.createLinearGradient(45,45,w-45,h-45);
    g.addColorStop(0,"#3b1b29");g.addColorStop(.52,"#24121c");g.addColorStop(1,"#351725");
    ctx.fillStyle=g;roundedRect(ctx,42,42,w-84,h-84,22);ctx.fill();
    ctx.strokeStyle="#e2bd79";ctx.lineWidth=7;roundedRect(ctx,52,52,w-104,h-104,18);ctx.stroke();
    ctx.strokeStyle="rgba(226,189,121,.55)";ctx.lineWidth=2;roundedRect(ctx,70,70,w-140,h-140,12);ctx.stroke();

    // Subtle rangoli-inspired corner geometry; kept away from the text-safe area.
    ctx.save();ctx.strokeStyle="rgba(226,189,121,.58)";ctx.lineWidth=2;
    for(const [x,y] of [[125,125],[w-125,125],[125,h-125],[w-125,h-125]]){
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        ctx.beginPath();ctx.ellipse(x+Math.cos(a)*22,y+Math.sin(a)*22,15,6,a,0,Math.PI*2);ctx.stroke();
      }
      ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle="#e2bd79";ctx.fill();
    }
    ctx.restore();

    // Small diya motif in the upper ornament band.
    const cx=w/2, top=108;
    ctx.save();ctx.translate(cx,top);
    ctx.fillStyle="#d8a85e";ctx.beginPath();ctx.ellipse(0,18,35,12,0,0,Math.PI);ctx.fill();
    ctx.fillStyle="#f8d58b";ctx.beginPath();ctx.moveTo(0,-25);ctx.bezierCurveTo(-17,-5,-10,5,0,8);ctx.bezierCurveTo(10,5,17,-5,0,-25);ctx.fill();
    ctx.fillStyle="#fff0c5";ctx.beginPath();ctx.arc(0,-4,4,0,Math.PI*2);ctx.fill();
    ctx.restore();

    if(logo.complete&&logo.naturalWidth){
      const max=112,ratio=logo.naturalWidth/logo.naturalHeight;
      const iw=ratio>=1?max:max*ratio, ih=ratio>=1?max/ratio:max;
      ctx.drawImage(logo,cx-iw/2,145,iw,ih);
    }
  }
  function drawSchoolHeader(){
    const w=canvas.width,cx=w/2;
    ctx.textAlign="center";ctx.fillStyle="#e8c98f";
    ctx.font="600 22px Georgia";ctx.fillText("ST. COLUMBUS PUBLIC SCHOOL",cx,285);
    ctx.fillStyle="#cbb58e";ctx.font="15px Arial";ctx.fillText("EKDARA  ·  JHAJHA",cx,311);
    ctx.strokeStyle="rgba(226,189,121,.7)";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(cx-115,330);ctx.lineTo(cx+115,330);ctx.stroke();
  }
  function drawSignatureFooter(){
    const w=canvas.width,h=canvas.height,cx=w/2;
    const lineY=h-155;
    ctx.strokeStyle="rgba(226,189,121,.5)";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(210,lineY);ctx.lineTo(w-210,lineY);ctx.stroke();

    // Principal signature is included on BOTH certificate designs.
    if(principalSignature.complete&&principalSignature.naturalWidth){
      const maxW=210,maxH=54,ratio=principalSignature.naturalWidth/principalSignature.naturalHeight;
      let sw=maxW,sh=sw/ratio;
      if(sh>maxH){sh=maxH;sw=sh*ratio;}
      ctx.drawImage(principalSignature,400-sw/2,lineY+8,sw,sh);
    }else{
      ctx.strokeStyle="#e8c98f";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(300,lineY+48);ctx.quadraticCurveTo(400,lineY+24,500,lineY+48);ctx.stroke();
    }
    ctx.textAlign="center";ctx.fillStyle="#e8c98f";ctx.font="bold 17px Georgia";
    ctx.fillText("PRINCIPAL",400,lineY+78);
    ctx.fillStyle="#cbb58e";ctx.font="14px Arial";
    ctx.fillText("St. Columbus Public School",400,lineY+99);

    ctx.fillStyle="#e8c98f";ctx.font="bold 19px Georgia";
    ctx.fillText("BHARAT TECH FORCE",1200,lineY+78);
    ctx.fillStyle="#cbb58e";ctx.font="14px Arial";
    ctx.fillText("PARTNER",1200,lineY+99);

    ctx.fillStyle="#d9bd86";ctx.font="14px Arial";
    ctx.fillText(`ISSUED ${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"})}`,cx,h-67);
  }
  function drawCertificate(data){
    const w=canvas.width,h=canvas.height,cx=w/2;
    drawDiwaliFrame();drawSchoolHeader();

    ctx.textAlign="center";ctx.fillStyle="#f8f0df";
    ctx.font="bold 65px Georgia";ctx.fillText("CERTIFICATE",cx,410);
    ctx.fillStyle="#e3bd7c";ctx.font="600 25px Georgia";
    ctx.fillText("OF PARTICIPATION",cx,455);

    ctx.fillStyle="#d9cbb4";ctx.font="23px Georgia";
    ctx.fillText("This certificate is proudly presented to",cx,535);

    const name=String(data.name||"Student Participant").trim().slice(0,60);
    ctx.fillStyle="#f2d69f";fitText(ctx,name,1120,60,34,"Georgia","italic 600");
    ctx.fillText(name,cx,630);
    ctx.strokeStyle="#c99d5d";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(330,655);ctx.lineTo(1270,655);ctx.stroke();

    ctx.fillStyle="#f1e5d1";ctx.font="23px Georgia";
    ctx.fillText("for taking part in the Diya Prajwalan Initiative",cx,715);
    ctx.fillStyle="#e7c58b";ctx.font="italic 27px Georgia";
    wrapText(ctx,`“${String(data.message||"A light for a brighter tomorrow").trim().slice(0,180)}”`,cx,775,1080,38,2);

    ctx.fillStyle="#cdbb9e";ctx.font="18px Arial";
    ctx.fillText("May your promise keep spreading light, kindness and hope.",cx,875);
    ctx.fillStyle="#e8c98f";ctx.font="bold 17px Arial";
    ctx.fillText("A FESTIVAL OF LIGHT. A PROMISE FOR TOMORROW.",cx,900);

    drawSignatureFooter();
  }

  function drawMomentCertificate(data){
    const w=canvas.width,h=canvas.height,cx=w/2;
    drawDiwaliFrame();drawSchoolHeader();

    ctx.textAlign="center";ctx.fillStyle="#f8f0df";
    ctx.font="bold 59px Georgia";ctx.fillText("A MOMENT SHARED",cx,405);
    ctx.fillStyle="#e3bd7c";ctx.font="600 21px Georgia";
    ctx.fillText("DIYA PRAJWALAN INITIATIVE  ·  DIWALI 2026",cx,452);

    const mediaLabel=data.mediaType==="video"?"VIDEO MOMENT":"PHOTOGRAPH";
    ctx.fillStyle="#e9dfcf";ctx.font="22px Georgia";
    ctx.fillText(`In appreciation of sharing a family ${mediaLabel.toLowerCase()}`,cx,525);
    ctx.fillText("and becoming part of a brighter school community",cx,560);

    const name=String(data.name||"Our Participant").trim().slice(0,60);
    ctx.fillStyle="#f2d69f";fitText(ctx,name,1120,58,32,"Georgia","italic 600");
    ctx.fillText(name,cx,645);

    const address=String(data.address||"").trim()||"India";
    ctx.fillStyle="#d9cbb4";ctx.font="19px Arial";
    fitText(ctx,`FROM: ${address}`,1050,20,15,"Arial","400");
    ctx.fillText(`FROM: ${address}`,cx,690);

    ctx.fillStyle="#e7c58b";ctx.font="bold 22px Georgia";
    ctx.fillText("A MEMORY CAPTURED. A PROMISE SHARED.",cx,750);

    ctx.fillStyle="#ffdfa6";ctx.font="italic 25px Georgia";
    wrapText(ctx,`“${String(data.message||"I promise to spread kindness, care for nature, and make tomorrow brighter.").trim().slice(0,240)}”`,cx,805,1080,34,3);

    ctx.fillStyle="#cdbb9e";ctx.font="18px Georgia";
    ctx.fillText("Thank you for sharing your moment and thoughtful promise with us.",cx,890,1120);
    drawSignatureFooter();
  }

  function openMomentCertificate(data){
    certificateData={...(data||{}),type:"moment"};
    drawMomentCertificate(certificateData);
    modal.hidden=false;
    if(!logo.complete)logo.onload=()=>{if(!modal.hidden&&certificateData.type==="moment")drawMomentCertificate(certificateData)};
    if(!principalSignature.complete)principalSignature.onload=()=>{if(!modal.hidden&&certificateData.type==="moment")drawMomentCertificate(certificateData)};
  }

  function openCertificate(data){
    certificateData={...(data||certificateData),type:"honor"};
    drawCertificate(certificateData);modal.hidden=false;
    if(!logo.complete)logo.onload=()=>{if(!modal.hidden&&certificateData.type==="honor")drawCertificate(certificateData)};
    if(!principalSignature.complete)principalSignature.onload=()=>{if(!modal.hidden&&certificateData.type==="honor")drawCertificate(certificateData)};
  }
  $("closeCertificate").addEventListener("click",()=>modal.hidden=true);modal.addEventListener("click",e=>{if(e.target===modal)modal.hidden=true});
  const getPng=()=>new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  $("downloadCertificate").addEventListener("click",async()=>{
    const blob=await getPng();if(!blob)return setStatus("The certificate could not be created. Please try again.",true);
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`${certificateData.type==="moment"?"St-Columbus-Moment-Shared":"St-Columbus-Diya-Certificate"}-${(certificateData.name||"participant").replace(/[^a-z0-9-]/gi,"-")}.png`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  $("shareCertificate").addEventListener("click",async()=>{
    const blob=await getPng();if(!blob)return setStatus("The certificate could not be created. Please download it instead.",true);
    const file=new File([blob],`${certificateData.type==="moment"?"St-Columbus-Moment-Shared":"St-Columbus-Diya-Certificate"}.png`,{type:"image/png"});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      try{
        const shareText = certificateData.type==="moment"
          ? `I shared a ${certificateData.mediaType||"photo"} moment with St. Columbus Public School, Ekdara, Jhajha. From: ${certificateData.address||"India"}. My promise: ${certificateData.message||"A promise for a brighter tomorrow."} A memory captured. A promise shared.`
          : "I took part in the Diya Prajwalan Initiative by St. Columbus Public School.";
        await navigator.share({files:[file],title:certificateData.type==="moment"?"A Moment Shared":"My Diya Promise Certificate",text:shareText})
      }
      catch(err){if(err.name!=="AbortError")setStatus("Sharing was unavailable. Download the PNG and share it manually.")}
    }else setStatus("This browser cannot share image files directly. Download the PNG, then attach it in WhatsApp or Instagram.");
  });
  $("whatsappCertificate").addEventListener("click",()=>{
    const text=certificateData.type==="moment"
      ? `I shared a ${certificateData.mediaType||"photo"} moment with St. Columbus Public School, Ekdara, Jhajha.\nFrom: ${certificateData.address||"India"}\n\nMy promise: ${certificateData.message||"A promise for a brighter tomorrow."}\n\nA memory captured. A promise shared.`
      : `I took part in the Diya Prajwalan Initiative at St. Columbus Public School. My promise: ${certificateData.message||"A light for a brighter tomorrow"}. I am sharing my certificate with you!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer");
    setStatus("WhatsApp opened. Download the certificate PNG and attach it to your message.");
  });
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target)}}),{threshold:.12});
  document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));
})();
