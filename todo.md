"
belajar:
@Exclude()
extends PartialType
extends PickType(targetClass, ['pick1','pick2'] as const)
extends OmitType(targetClass, ['pick1','pick2'] as const)
app.useGlobalPipes(new (require('@nestjs/common').ValidationPipe)({
transform: true,
whitelist: true,
forbidNonWhitelisted: true,
}),) //untuk validation
"

start 12/11/2025
[x] add: setup redis
[x] add: authentication
[x] add: frontend mock design full
[x] add: system design
[x] add: Menu all-warehouse management
[70%] add: members management
[x] add: admin/dock
[x] add: admin/organization-management
[x] add: organization swither
[x] add: warehouse swither
[x] add: busy time CRUD
[x] add: Menu my-warehouse management
[x] add: Menu vehicles management
[x] add: admin dock management
[x] add: (main) set booking
[x] add: entitas vendor yang tidak perlu/bisa create dan update
[x] mod: ubah penamaan dock -> gate untuk frontend
[x] add: history booking page
[x] add: plan visit page
[x] add: ROLE untuk fleksibilitas description tidak bisa dijadikan acuan soalnya, penulisannya tidak diketahui, siapa yang bisa buka ini dan itu
[x] authorization decorator tinggal gunakan
[x]add: setup opsi allowedTypes
[x] mod: VehicleType sudah sanget lengkap untuk semua tipe
[x] REMINDER: Jangan pernah pakai enum di database lagi!!
[x] add: member management
[x] add: live queue untuk melihat booking vendor, preview detail booking vendor, mengatur ulang waktu booking vendor
[x] fix: selected visualStartTime and visualEndTime tidak keliatan
[x] fix: actualArrivalTime dicatat sebagai pertanda dia sudah dtg dan di live queue akan ada tanda bahwa ia telah datang.
[x] fix: drag Waktu bertabrakan dengan busy time, harusnya ia mencari waktu kosong di dihari ini yang cukup bukan memaksa dekat dengan jam sekarang
[] mod: dari awal harusnya pakai websocket(socket.io) karena ini app realtime

//live queue complex UI drag drop
[x] add: bisa drag dari antrian IN_PROGRESS menjadi UNLOADING
[x] add: bisa drag dari DELAYED menjadi UNLOADING
[x] add: bisa drag dari DELAYED menjadi CANCELED
[] add: bisa tukar urutan dock yang sama :
[x] add: bisa drag dari inprogress ke CANCELED (inventory section)
[x] add: bisa drag dari canceled ke inprogress
[x] add: bisa drag dari canceled ke unloading
[x] add: bisa drag SWAP
[x] add: bisa drag BEFORE, AFTER
[] fix: side-nav tidak bisa ngembang

<!-- REALTIME TEST CASE CHECK: -->

[x] buat booking baru langsung muncul
[x] perubahan status completed
[x] perubahan status canceled
[x] perubahan status unloading
[x] perubahan status delayed
[x] keterlambatan sesuai waktu delayeTolerance
[x] nomor plat wajib
[x] fix: code tidak cukup hanya {driver}-{vendor}, nanti kalau banyak akan duplikat
[x] driver menu realtime monitoring
[x] perbaikin tampilan supir yang lebih jelas
[x] add: warehouse setting untuk ruling berbeda tiap warehouse
[x] add: dashboard driver & vendor admin dengan endpoint sudah ada stats/...
[x] add: My Warehouse untuk library utama warehouse dan konfirmasinya (required: filter kompleks)

# Meeting 28-01-2026

[x] add: dashboard vendor versi 1
[x] add: perlu konfirmasi booking
[x] add: template mobil per warehouse bukan universal
[x] add: tracing tiap perubahan arrivalTime
[x] add: penyempurnaan role
[x] add: opsi mobil per warehouse bukan global
[x] add: dock bisa import
[x] mod: pemberitahuan dari sistem realtime kepada supir dan vendor terkait
[x] mod: penyempurnaan dashboard admin versi 1
[x] fix: perbaiki yang berhubungan dengan useSearch Params
[x] fix: tidak bisa logout
[x] fix: user tidak bisa dihapus
[x] fix: error petunjuk tidak keluar saat kesalahan membuat account
[x] add: import app user
[x] add: perlu jenis VehicleType ada yang bisa masuk dan ada yang tidak bisa

[] mod: race condition booking
[] fix: Suspense yang masih di root layout, ini bakal buat app banyak nampil loading
[] add: limit kubikasi => pakai template mobil berbeda aja, muatan 20%, 50%:
Menentukan durasi bongkar mobil =
vehicle.durasiBongkar × (0.3 + (1 − 0.3) × loadPercent/100)


sulit :
[] fix: droppable canceled inventory masih belum sempurna
