import json, cv2, numpy as np, os
from shapely.geometry import Polygon, box, Point
from shapely.ops import unary_union
W='work/'; APP='public/'
plan=json.load(open(W+'plan.json'))
slab=Polygon(plan['slab']).buffer(0); inter=Polygon(plan['interior']).buffer(0)
balc=slab.difference(inter)
walls=unary_union([Polygon(w['o']).buffer(0) for w in plan['walls']])
CAMS={1:(1543,501),2:(1546,656),3:(1736,656),4:(1821,656),5:(1795,401),6:(1753,229),7:(1907,84),8:(2126,290),9:(2298,167),10:(1551,226),11:(2032,396),12:(2045,693),13:(2199,694),14:(2064,1063),15:(2274,1063),16:(1783,1257),17:(1798,988),18:(1205,976),19:(1183,1191),20:(784,992),21:(793,1096),22:(633,927),23:(509,927),24:(521,773),25:(345,931),26:(174,1033),27:(35,1032),28:(328,1216),29:(509,1239),30:(511,1067),31:(643,582),32:(644,391),33:(509,382),34:(392,376),35:(189,227),36:(406,106),37:(529,123),38:(43,326),39:(500,582),40:(369,583),41:(206,679),42:(346,798)}
CAMNAME={1:'Lift Car',2:'Lift Lobby',3:'Grand Living 01',4:'Grand Living 02',5:'Dining 01',6:'Kitchen Hallway',7:'Gourmet Kitchen',8:'Dining 03',9:'Dining 04 Balcony',10:'Service Kitchen',11:'Dining 02',12:'Grand Living 03',13:'Grand Living Balcony',14:'Salon 03',15:'Salon 04 Balcony',16:'Salon 02',17:'Salon 01 Hallway',18:'Hallway Flex Space',19:'Flex Space',20:'Hallway 02 4th Bedroom',21:'4th Bedroom',22:'Hallway 01 Primary Bedroom',23:'Primary Bedroom Entrance',24:'Primary Bedroom Closet',25:'Primary Bedroom 03',26:'Primary Bedroom 04',27:'Primary Bedroom Balcony',28:'Primary bedroom 05',29:'Primary ENsuite 01',30:'Primary Ensuite 02',31:'Hallway 04 3rd Bedroom',32:'Hallway 05 2nd Bedroom',33:'2nd Bedroom Entrance',34:'2nd Bedroom 02',35:'2nd Bedroom 03',36:'2nd Bedroom 04',37:'2nd Bedroom Ensuite',38:'2nd Bedroom Balcony',39:'3rd Bedroom entrance',40:'3rd Bedroom 01',41:'3rd Bedroom balcony',42:'3rd Bedroom 02'}
def R(x0,y0,x1,y1): return box(x0,y0,x1,y1)
ROOMS=[
 dict(id='lobby',name='Private Lift Lobby',zone='arrival',icon='lift',cams=[2,1],poly=Polygon([(1100,440),(1265,440),(1265,595),(1630,595),(1630,720),(1265,720),(1265,915),(1100,915)]),clip='in',
      floor='Herringbone limestone',ceil=3.2,info='A private lift opens straight into the residence. Herringbone limestone, bronze lift portals and backlit onyx niches set the tone on arrival.',feat=['Two private passenger lifts','Service lift to the back of house','Backlit onyx feature niches']),
 dict(id='living',name='Grand Living',zone='living',icon='sofa',cams=[4,3,12],poly=R(1722,420,2100,960),clip='in',
      floor='Wide-plank oak, smoked',ceil=3.4,info='The heart of the home: two conversation groups under a 3.4 m ceiling, framed by curved full-height glazing that opens to the wrap-around terrace.',feat=['Floor-to-ceiling curved glazing','Walnut wine and display wall','Opens to the Living Terrace']),
 dict(id='living-terrace',name='Living Terrace',zone='outdoor',icon='leaf',cams=[13],poly=R(2100,420,2400,960),clip='out',
      floor='Teak-look porcelain decking',ceil=3.2,info='A deep, planted terrace with clear glass balustrades and skyline views across the park.',feat=['Frameless glass balustrade','Built-in planters','Outdoor lighting']),
 dict(id='dining',name='Formal Dining',zone='living',icon='dining',cams=[11,5,8],poly=R(1722,205,2178,420),clip='in',
      floor='Wide-plank oak, smoked',ceil=3.4,info='An oval table for twelve beneath sculptural pendants, between the show kitchen and the living room.',feat=['Seats twelve','Backlit stone feature wall','Opens to the Dining Terrace']),
 dict(id='kitchen',name='Show Kitchen',zone='living',icon='kitchen',cams=[7,6],poly=R(1722,40,2178,205),clip='in',
      floor='Wide-plank oak, smoked',ceil=3.2,info='A statement island in Patagonia quartzite with an integrated cooktop and sink, backed by full-height dark-oak joinery.',feat=['3.6 m quartzite island','Integrated appliances','Separate service kitchen behind']),
 dict(id='dining-terrace',name='Dining Terrace',zone='outdoor',icon='leaf',cams=[9],poly=R(2178,0,2400,420),clip='out',
      floor='Teak-look porcelain decking',ceil=3.2,info='Al fresco dining for six on the north-east corner, steps from the show kitchen.',feat=['Round stone dining table','Planters with olive trees','Morning sun']),
 dict(id='service-kitchen',name='Service Kitchen',zone='service',icon='kitchen',cams=[10],poly=R(1380,95,1690,340),clip='in',
      floor='Honed limestone',ceil=2.9,info='A fully equipped back-of-house kitchen with its own service lift and entry.',feat=['Gas cooktop and wall ovens','Full-height refrigeration','Service lift access']),
 dict(id='salon',name='Salon',zone='living',icon='glass',cams=[17,14,16],poly=R(1722,960,2178,1310),clip='in',
      floor='Wide-plank oak, smoked',ceil=3.4,info='A softer, intimate lounge around a curved sofa and a glass cocktail table, with a bar console along the glazing.',feat=['Curved bespoke sofa','Bar console','Opens to the Salon Terrace']),
 dict(id='salon-terrace',name='Salon Terrace',zone='outdoor',icon='leaf',cams=[15],poly=R(2178,960,2400,1356),clip='out',
      floor='Teak-look porcelain decking',ceil=3.2,info='An outdoor lounge with woven loungers on a terracotta rug, catching the afternoon light.',feat=['Outdoor lounge for six','Planters','Sunset views']),
 dict(id='study',name='Study',zone='private',icon='study',cams=[],poly=R(1310,1080,1700,1310),clip='in',
      floor='Wide-plank oak, smoked',ceil=3.0,info='A quiet room off the salon, ready to be fitted as a study, media room or guest suite.',feat=['Angled feature wall','Built-in storage','Facade glazing']),
 dict(id='flex',name='Flex Lounge',zone='living',icon='lounge',cams=[18,19],poly=R(1040,930,1300,1240),clip='in',
      floor='Wide-plank oak, natural',ceil=3.2,info='A reading lounge at the crossing of the gallery, with a glass-walled flex room beyond that can be a family room or office.',feat=['Sliding glass partition','Reading corner','South light']),
 dict(id='gallery',name='Gallery',zone='circulation',icon='hall',cams=[22,20],poly=Polygon([(600,250),(690,250),(690,930),(1040,930),(1040,1012),(430,1012),(430,930),(600,930)]),clip='in',
      floor='Wide-plank oak, natural',ceil=3.0,info='A long gallery links the bedroom wing to the living spaces, with full-height doors in dark oak.',feat=['Art lighting','Full-height doors','Hidden storage']),
 dict(id='bed4',name='Bedroom 4',zone='private',icon='bed',cams=[21,20],poly=R(845,1012,1040,1320),clip='in',
      floor='Wide-plank oak, natural',ceil=3.0,info='A guest bedroom with a panelled headboard wall, a reading chair and a desk along the curved facade.',feat=['Queen bed','Built-in wardrobe','En-suite shower room']),
 dict(id='primary',name='Primary Bedroom',zone='private',icon='bed',cams=[25,26,28,23],poly=R(178,850,432,1320),clip='in',
      floor='Wide-plank oak, natural',ceil=3.2,info='A corner suite with its own lounge, a bowed upholstered headboard wall and a private terrace on two sides.',feat=['King bed and lounge','Dressing room and ensuite','Private terrace']),
 dict(id='primary-bath',name='Primary Ensuite',zone='private',icon='bath',cams=[29,30],poly=R(432,1000,640,1320),clip='in',
      floor='Calacatta marble',ceil=3.0,info='Double vanity in honed stone, a freestanding tub at the window, walk-in shower and separate WCs.',feat=['Freestanding bathtub','Double vanity','Walk-in rain shower']),
 dict(id='primary-closet',name='Primary Dressing Room',zone='private',icon='closet',cams=[24],poly=R(432,600,600,860),clip='in',
      floor='Wide-plank oak, natural',ceil=3.0,info='A walk-through dressing room with glass-fronted wardrobes and a stone-topped island.',feat=['Glass-fronted wardrobes','Island with drawers','Shoe wall']),
 dict(id='primary-terrace',name='Primary Terrace',zone='outdoor',icon='leaf',cams=[27],poly=R(0,770,178,1356),clip='out',
      floor='Teak-look porcelain decking',ceil=3.2,info='A wraparound terrace with a daybed and an outdoor lounge, wrapped by planting.',feat=['Daybed','Outdoor lounge','West views']),
 dict(id='bed3',name='Bedroom 3',zone='private',icon='bed',cams=[40,42,39,31],poly=R(219,555,432,830),clip='in',
      floor='Wide-plank oak, natural',ceil=3.0,info='A bright bedroom with its own planted terrace, shown unfurnished.',feat=['Planted terrace','Built-in wardrobe','En-suite']),
 dict(id='bed3-terrace',name='Bedroom 3 Terrace',zone='outdoor',icon='leaf',cams=[41],poly=R(60,585,219,770),clip='out',
      floor='Teak-look porcelain decking',ceil=3.2,info='A small planted terrace off Bedroom 3.',feat=['Planters','Glass balustrade','City view']),
 dict(id='bed2',name='Bedroom 2',zone='private',icon='bed',cams=[34,35,36,33,32],poly=R(178,40,432,430),clip='in',
      floor='Wide-plank oak, natural',ceil=3.2,info='A second suite with a writing desk, a sculptural chaise and its own terrace and ensuite.',feat=['King bed','Writing desk','Ensuite and terrace']),
 dict(id='bed2-bath',name='Bedroom 2 Ensuite',zone='private',icon='bath',cams=[37],poly=R(432,40,620,210),clip='in',
      floor='Calacatta marble',ceil=3.0,info='A marble ensuite with a long vanity, walk-in shower and WC.',feat=['Long vanity','Walk-in shower','Separate WC']),
 dict(id='bed2-terrace',name='Bedroom 2 Terrace',zone='outdoor',icon='leaf',cams=[38],poly=R(0,0,178,585),clip='out',
      floor='Teak-look porcelain decking',ceil=3.2,info='A long west terrace with a lounger and an outdoor seating corner.',feat=['Lounger','Outdoor seating','Planters']),
]
labels=json.load(open(W+'pano-labels.json'))
bylabel={}
for pid,l in labels.items():
    k=l.lower().replace(' furnished','').replace(' unfurnished','')
    fur='unfurnished' not in l.lower()
    bylabel.setdefault(k,{})['dressed' if fur else 'bare']=pid
os.makedirs(APP+'thumbs',exist_ok=True)
SRC='tour-media/'
S=1/58
out=[]
for r in ROOMS:
    p=r['poly'].intersection(inter if r['clip']=='in' else balc)
    if p.geom_type!='Polygon': p=max(p.geoms,key=lambda g:g.area)
    p=p.simplify(1.5)
    floor=p.difference(walls)
    area=floor.area*S*S
    x0,y0,x1,y1=p.bounds
    pin=CAMS[r['cams'][0]] if r['cams'] else p.representative_point().coords[0]
    if not p.buffer(2).contains(Point(pin)): pin=p.representative_point().coords[0]
    thumb=None
    for c in r['cams']:
        nm=CAMNAME[c].lower(); pid=bylabel.get(nm,{}).get('dressed')
        if pid and os.path.exists(SRC+pid+'_hd_t.jpg'):
            im=cv2.imread(SRC+pid+'_hd_t.jpg'); h,w=im.shape[:2]
            crop=im[int(h*0.27):int(h*0.73),int(w*0.25):int(w*0.75)]
            crop=cv2.resize(crop,(480,int(480*crop.shape[0]/crop.shape[1])),interpolation=cv2.INTER_AREA)
            cv2.imwrite(APP+'thumbs/'+r['id']+'.jpg',crop,[cv2.IMWRITE_JPEG_QUALITY,82]); thumb='thumbs/'+r['id']+'.jpg'; break
    out.append(dict(id=r['id'],name=r['name'],zone=r['zone'],icon=r['icon'],poly=[[round(x,1),round(y,1)] for x,y in p.exterior.coords][:-1],
        area=round(area,1),dims=[round((x1-x0)*S,1),round((y1-y0)*S,1)],pin=[round(pin[0],1),round(pin[1],1)],
        cams=[dict(n=c,name=CAMNAME[c],x=CAMS[c][0],y=CAMS[c][1]) for c in r['cams']],thumb=thumb,
        floor=r['floor'],ceiling=r['ceil'],info=r['info'],features=r['feat']))
    print(r['id'],round(area,1),thumb)
json.dump(dict(rooms=out),open(APP+'data/rooms.json','w'),indent=0)
print('total interior m2',round(sum(o['area'] for o in out if o['zone']!='outdoor'),1),'outdoor',round(sum(o['area'] for o in out if o['zone']=='outdoor'),1))
